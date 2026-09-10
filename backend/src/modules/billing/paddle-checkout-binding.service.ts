import { ConflictException, Injectable } from '@nestjs/common';
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
  } | null;
}>;

type BindingInput = {
  paddleSubscriptionId: string;
  paddleTransactionId?: string;
  paddleCustomerId: string | null;
  items: PaddleSubscriptionItems;
};

@Injectable()
export class PaddleCheckoutBindingService {
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

function bindingConflict(code: string) {
  return new ConflictException({
    code,
    message:
      'Paddle olayı doğrulanmış bir ödeme ve abonelik kaydıyla eşleştirilemedi.',
  });
}
