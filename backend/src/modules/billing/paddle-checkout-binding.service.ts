import { ConflictException, Injectable } from '@nestjs/common';
import type { TransactionNotification } from '@paddle/paddle-node-sdk';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingCycle,
  BillingCheckoutStatus,
  BillingSubscriptionStatus,
} from '../../generated/prisma/enums';
import {
  paddleCheckoutEnvironment,
  paddlePlanForPrice,
} from './paddle-billing.config';

type PaddleSubscriptionItems = ReadonlyArray<{
  quantity: number;
  price: {
    id: string;
    billingCycle: { interval: string; frequency: number } | null;
    trialPeriod: { interval: string; frequency: number } | null;
  } | null;
}>;

type BindingInput = {
  paddleSubscriptionId: string;
  paddleTransactionId?: string;
  paddleCustomerId: string | null;
  items: PaddleSubscriptionItems;
};

type RecoveryResult = {
  checkoutId: string;
  workspaceId: string;
  recovered: boolean;
};

const BOUND_SUBSCRIPTION_TRANSACTION_ORIGINS = new Set<
  TransactionNotification['origin']
>([
  'subscription_charge',
  'subscription_payment_method_change',
  'subscription_recurring',
  'subscription_update',
]);

@Injectable()
export class PaddleCheckoutBindingService {
  async recoverTransaction(
    transaction: Prisma.TransactionClient,
    notification: TransactionNotification,
  ): Promise<RecoveryResult | null> {
    const checkoutId = recoveryCheckoutId(notification.customData);
    if (!checkoutId) return null;

    const candidate = await transaction.billingCheckout.findUnique({
      where: { id: checkoutId },
      select: { workspaceId: true },
    });
    if (!candidate) throw recoveryConflict();

    // Keep the same lock order as subscription binding and checkout creation.
    await transaction.$queryRaw`
      SELECT "id" FROM "workspace" WHERE "id" = ${candidate.workspaceId} FOR UPDATE
    `;
    await transaction.$queryRaw`
      SELECT "id" FROM "billing_subscription"
      WHERE "workspaceId" = ${candidate.workspaceId} FOR UPDATE
    `;
    await transaction.$queryRaw`
      SELECT "id" FROM "billing_checkout" WHERE "id" = ${checkoutId} FOR UPDATE
    `;

    const [checkout, subscription] = await Promise.all([
      transaction.billingCheckout.findUnique({ where: { id: checkoutId } }),
      transaction.billingSubscription.findUnique({
        where: { workspaceId: candidate.workspaceId },
      }),
    ]);
    if (!checkout || !subscription) throw recoveryConflict();

    const isCompletedBinding = Boolean(
      checkout.status === BillingCheckoutStatus.COMPLETED &&
      checkout.boundAt &&
      checkout.paddleSubscriptionId,
    );

    if (
      isCompletedBinding &&
      checkout.paddleTransactionId !== notification.id
    ) {
      validateBoundSubscriptionTransaction(
        checkout,
        subscription,
        notification,
      );

      // Paddle can inherit the initial checkout custom data into recurring,
      // subscription-change, and other subscription transactions. These are
      // not missing initial checkout bindings and must never replace the
      // transaction ID stored on the completed checkout. They may, however,
      // signal that the authoritative subscription snapshot should be checked
      // promptly in case its webhook is delayed.
      await transaction.billingSubscription.update({
        where: { id: subscription.id },
        data: { reconcileAfter: new Date() },
      });

      return {
        checkoutId: checkout.id,
        workspaceId: checkout.workspaceId,
        recovered: false,
      };
    }

    validateRecoveryTransaction(checkout, subscription, notification);

    if (checkout.paddleTransactionId) {
      if (checkout.paddleTransactionId !== notification.id)
        throw recoveryConflict();
      return {
        checkoutId: checkout.id,
        workspaceId: checkout.workspaceId,
        recovered: false,
      };
    }
    if (
      checkout.status !== BillingCheckoutStatus.CREATING &&
      checkout.status !== BillingCheckoutStatus.REVIEW_REQUIRED
    ) {
      throw recoveryConflict();
    }

    // The unique transaction constraint and conditional claim prevent two
    // reservations from adopting the same Paddle transaction concurrently.
    const claimed = await transaction.billingCheckout.updateMany({
      where: {
        id: checkout.id,
        workspaceId: checkout.workspaceId,
        environment: paddleCheckoutEnvironment(),
        status: {
          in: [
            BillingCheckoutStatus.CREATING,
            BillingCheckoutStatus.REVIEW_REQUIRED,
          ],
        },
        paddleTransactionId: null,
      },
      data: {
        paddleTransactionId: notification.id,
        status: BillingCheckoutStatus.OPEN,
      },
    });
    if (claimed.count !== 1) throw recoveryConflict();

    // Let the regular Paddle snapshot reconciliation complete any subscription
    // binding. A transaction notification itself never grants access.
    await transaction.billingSubscription.update({
      where: { id: subscription.id },
      data: { reconcileAfter: new Date() },
    });

    return {
      checkoutId: checkout.id,
      workspaceId: checkout.workspaceId,
      recovered: true,
    };
  }

  async resolve(transaction: Prisma.TransactionClient, input: BindingInput) {
    const item = input.items[0];
    const priceId = item?.price?.id;
    const selection = paddlePlanForPrice(priceId);
    if (
      input.items.length !== 1 ||
      item?.quantity !== 1 ||
      !priceId ||
      !selection ||
      item.price?.billingCycle?.frequency !== 1 ||
      item.price.billingCycle.interval !==
        (selection.cycle === BillingCycle.MONTHLY ? 'month' : 'year')
    ) {
      throw bindingConflict('PADDLE_PRICE_MISMATCH');
    }
    if (!input.paddleCustomerId) {
      throw bindingConflict('PADDLE_CUSTOMER_MISMATCH');
    }

    const checkout = input.paddleTransactionId
      ? await transaction.billingCheckout.findUnique({
          where: { paddleTransactionId: input.paddleTransactionId },
        })
      : null;
    const linkedSubscription = checkout
      ? null
      : await transaction.billingSubscription.findUnique({
          where: { paddleSubscriptionId: input.paddleSubscriptionId },
        });
    const workspaceId =
      checkout?.workspaceId ?? linkedSubscription?.workspaceId;
    if (!workspaceId) {
      // A later subscription event can arrive before subscription.created
      // establishes the binding. Roll back for retry.
      throw bindingConflict('PADDLE_SUBSCRIPTION_UNLINKED');
    }

    // Serialize all state updates as well as initial bindings. The caller must
    // keep this transaction open through its timestamp check and final update.
    // Lock order is always workspace -> subscription -> checkout.
    await transaction.$queryRaw`
      SELECT "id" FROM "workspace" WHERE "id" = ${workspaceId} FOR UPDATE
    `;
    await transaction.$queryRaw`
      SELECT "id" FROM "billing_subscription" WHERE "workspaceId" = ${workspaceId} FOR UPDATE
    `;
    const subscription = await transaction.billingSubscription.findUnique({
      where: { workspaceId },
    });
    if (!subscription) throw bindingConflict('PADDLE_SUBSCRIPTION_UNLINKED');

    if (
      subscription.paddleCustomerId &&
      subscription.paddleCustomerId !== input.paddleCustomerId
    ) {
      throw bindingConflict('PADDLE_CUSTOMER_MISMATCH');
    }
    // Never bind a new paid CoreAssist subscription to a Paddle trial. Keep
    // already-bound legacy subscriptions reconcilable so activation/cancel
    // events can still repair their lifecycle instead of becoming stuck.
    if (
      item.price?.trialPeriod !== null &&
      subscription.paddleSubscriptionId !== input.paddleSubscriptionId
    ) {
      throw bindingConflict('PADDLE_PRICE_TRIAL_NOT_ALLOWED');
    }

    if (checkout) {
      if (
        checkout.status !== BillingCheckoutStatus.OPEN &&
        checkout.status !== BillingCheckoutStatus.COMPLETED
      ) {
        throw bindingConflict('PADDLE_CHECKOUT_MISMATCH');
      }
      if (
        checkout.environment !== paddleCheckoutEnvironment() ||
        checkout.paddlePriceId !== priceId ||
        checkout.plan !== selection.plan ||
        checkout.cycle !== selection.cycle
      ) {
        throw bindingConflict('PADDLE_CHECKOUT_MISMATCH');
      }
      if (
        checkout.expectedPaddleCustomerId &&
        checkout.expectedPaddleCustomerId !== input.paddleCustomerId
      ) {
        throw bindingConflict('PADDLE_CUSTOMER_MISMATCH');
      }
      if (
        checkout.paddleSubscriptionId &&
        checkout.paddleSubscriptionId !== input.paddleSubscriptionId
      ) {
        throw bindingConflict('PADDLE_SUBSCRIPTION_MISMATCH');
      }

      if (subscription.paddleSubscriptionId !== input.paddleSubscriptionId) {
        const replacingEndedSubscription =
          subscription.status === BillingSubscriptionStatus.CANCELED ||
          subscription.status === BillingSubscriptionStatus.EXPIRED;
        if (
          checkout.boundAt ||
          subscription.paddleSubscriptionId !==
            checkout.previousPaddleSubscriptionId ||
          (subscription.paddleSubscriptionId && !replacingEndedSubscription)
        ) {
          throw bindingConflict('PADDLE_SUBSCRIPTION_MISMATCH');
        }
      }

      // A conditional claim also protects a checkout read before the lock from
      // being reused for a different subscription after another event commits.
      const claimed = await transaction.billingCheckout.updateMany({
        where: {
          id: checkout.id,
          status: {
            in: [BillingCheckoutStatus.OPEN, BillingCheckoutStatus.COMPLETED],
          },
          OR: [
            { paddleSubscriptionId: null },
            { paddleSubscriptionId: input.paddleSubscriptionId },
          ],
        },
        data: {
          paddleSubscriptionId: input.paddleSubscriptionId,
          boundAt: checkout.boundAt ?? new Date(),
          status: BillingCheckoutStatus.COMPLETED,
        },
      });
      if (claimed.count !== 1)
        throw bindingConflict('PADDLE_SUBSCRIPTION_MISMATCH');
    } else if (
      subscription.paddleSubscriptionId !== input.paddleSubscriptionId ||
      subscription.paddleCustomerId !== input.paddleCustomerId
    ) {
      throw bindingConflict('PADDLE_SUBSCRIPTION_MISMATCH');
    }

    return { subscription, selection, priceId };
  }
}

function validateRecoveryTransaction(
  checkout: Prisma.BillingCheckoutGetPayload<object>,
  subscription: Prisma.BillingSubscriptionGetPayload<object>,
  notification: TransactionNotification,
) {
  const item = notification.items[0];
  const priceId = item?.price?.id;
  const selection = paddlePlanForPrice(priceId);
  const metadata = notification.customData;
  const expectedCustomer = checkout.expectedPaddleCustomerId;
  const isBound = Boolean(
    checkout.status === BillingCheckoutStatus.COMPLETED &&
    checkout.boundAt &&
    checkout.paddleSubscriptionId,
  );
  const bindingMismatch = isBound
    ? subscription.paddleSubscriptionId !== checkout.paddleSubscriptionId ||
      (notification.subscriptionId !== null &&
        notification.subscriptionId !== checkout.paddleSubscriptionId) ||
      (notification.customerId !== null &&
        notification.customerId !== subscription.paddleCustomerId)
    : checkout.previousPaddleSubscriptionId !==
        subscription.paddleSubscriptionId ||
      checkout.expectedPaddleCustomerId !== subscription.paddleCustomerId ||
      (expectedCustomer !== null &&
        notification.customerId !== expectedCustomer);

  if (
    notification.origin !== 'api' ||
    checkout.environment !== paddleCheckoutEnvironment() ||
    checkout.workspaceId !== subscription.workspaceId ||
    bindingMismatch ||
    notification.items.length !== 1 ||
    item?.quantity !== 1 ||
    !priceId ||
    priceId !== checkout.paddlePriceId ||
    !selection ||
    selection.plan !== checkout.plan ||
    selection.cycle !== checkout.cycle ||
    item.price?.billingCycle?.frequency !== 1 ||
    item.price.trialPeriod !== null ||
    item.price.billingCycle.interval !==
      (checkout.cycle === BillingCycle.MONTHLY ? 'month' : 'year') ||
    customString(metadata, 'coreassist_workspace_id') !==
      checkout.workspaceId ||
    customString(metadata, 'coreassist_plan') !== checkout.plan ||
    customString(metadata, 'coreassist_cycle') !== checkout.cycle
  ) {
    throw recoveryConflict();
  }
}

function validateBoundSubscriptionTransaction(
  checkout: Prisma.BillingCheckoutGetPayload<object>,
  subscription: Prisma.BillingSubscriptionGetPayload<object>,
  notification: TransactionNotification,
) {
  const metadata = notification.customData;

  if (
    !BOUND_SUBSCRIPTION_TRANSACTION_ORIGINS.has(notification.origin) ||
    checkout.environment !== paddleCheckoutEnvironment() ||
    checkout.workspaceId !== subscription.workspaceId ||
    !checkout.paddleSubscriptionId ||
    subscription.paddleSubscriptionId !== checkout.paddleSubscriptionId ||
    notification.subscriptionId !== checkout.paddleSubscriptionId ||
    !subscription.paddleCustomerId ||
    notification.customerId !== subscription.paddleCustomerId ||
    customString(metadata, 'coreassist_workspace_id') !== checkout.workspaceId
  ) {
    throw recoveryConflict();
  }
}

function recoveryCheckoutId(customData: unknown) {
  const value = customString(customData, 'coreassist_checkout_id');
  return value && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : null;
}

function customString(customData: unknown, key: string) {
  if (
    !customData ||
    typeof customData !== 'object' ||
    Array.isArray(customData)
  )
    return null;
  const value = (customData as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function recoveryConflict() {
  return new ConflictException({
    code: 'PADDLE_TRANSACTION_RECOVERY_MISMATCH',
    message:
      'Paddle işlemi bekleyen ödeme rezervasyonuyla güvenli biçimde eşleştirilemedi.',
  });
}

function bindingConflict(code: string) {
  return new ConflictException({
    code,
    message:
      'Paddle olayı doğrulanmış bir ödeme ve abonelik kaydıyla eşleştirilemedi.',
  });
}
