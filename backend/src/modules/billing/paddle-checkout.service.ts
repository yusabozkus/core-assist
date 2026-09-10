import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiError, Paddle, type Transaction } from '@paddle/paddle-node-sdk';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import {
  PENDING_PLAN_CHANGE_STATUSES,
  planChangeConflict,
} from './billing-plan-change.policy';
import {
  BillingCheckoutStatus,
  BillingCycle,
  BillingPlan,
  BillingSubscriptionStatus,
  PaddleEnvironment,
} from '../../generated/prisma/enums';
import {
  paddleCheckoutEnvironment,
  paddlePriceId,
} from './paddle-billing.config';

type Checkout = Prisma.BillingCheckoutGetPayload<object>;
type Selection = {
  workspaceId: string;
  userId: string;
  plan: BillingPlan;
  cycle: BillingCycle;
};
type CheckoutState =
  'ready' | 'preparing' | 'payment_pending' | 'plan_conflict';
type CheckoutResult = {
  state: CheckoutState;
  transactionId: string | null;
  environment: 'production' | 'sandbox';
  plan: BillingPlan;
  cycle: BillingCycle;
  canCancel: boolean;
};
type CancelCheckoutResult = {
  canceled: boolean;
  transactionId: string | null;
};
const PENDING_STATUSES = [
  BillingCheckoutStatus.CREATING,
  BillingCheckoutStatus.OPEN,
  BillingCheckoutStatus.REVIEW_REQUIRED,
];

@Injectable()
export class PaddleCheckoutService {
  private readonly logger = new Logger(PaddleCheckoutService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrReuse(
    input: Selection,
    client: Paddle,
  ): Promise<CheckoutResult> {
    const environment = paddleCheckoutEnvironment();
    const priceId = paddlePriceId(input.plan, input.cycle);
    const reserved = await this.withWorkspaceLock(
      input.workspaceId,
      async (tx) => {
        if (
          await tx.billingPlanChange.findFirst({
            where: {
              workspaceId: input.workspaceId,
              status: { in: PENDING_PLAN_CHANGE_STATUSES },
            },
            select: { id: true },
          })
        ) {
          throw planChangeConflict(
            'BILLING_PLAN_CHANGE_PENDING',
            'Plan değişikliği sonuçlanmadan yeni ödeme başlatılamaz.',
          );
        }
        const subscription = await tx.billingSubscription.findUniqueOrThrow({
          where: { workspaceId: input.workspaceId },
        });
        if (
          subscription.paddleSubscriptionId &&
          (subscription.status === BillingSubscriptionStatus.ACTIVE ||
            subscription.status === BillingSubscriptionStatus.TRIALING)
        ) {
          const completed = await tx.billingCheckout.findUnique({
            where: { paddleSubscriptionId: subscription.paddleSubscriptionId },
          });
          if (
            completed?.status === BillingCheckoutStatus.COMPLETED &&
            completed.paddlePriceId === priceId &&
            subscription.paddlePriceId === priceId
          ) {
            return { checkout: completed, created: false };
          }
        }
        assertNoActiveSubscription(subscription);
        const pending = await tx.billingCheckout.findFirst({
          where: {
            workspaceId: input.workspaceId,
            status: { in: PENDING_STATUSES },
          },
        });
        if (pending) return { checkout: pending, created: false };

        // Commit the reservation BEFORE making a non-idempotent external request.
        // A process crash/network timeout must never release this slot implicitly.
        const checkout = await tx.billingCheckout.create({
          data: {
            workspaceId: input.workspaceId,
            requestedByUserId: input.userId,
            environment,
            status: BillingCheckoutStatus.CREATING,
            plan: input.plan,
            cycle: input.cycle,
            paddlePriceId: priceId,
            expectedPaddleCustomerId: subscription.paddleCustomerId,
            previousPaddleSubscriptionId: subscription.paddleSubscriptionId,
          },
        });
        return { checkout, created: true };
      },
    );

    const { checkout } = reserved;
    if (checkout.environment !== environment) throw reviewRequired();
    if (checkout.status === BillingCheckoutStatus.COMPLETED)
      return checkoutResult(checkout, 'payment_pending');
    if (reserved.created) return this.createTransaction(checkout, client);
    if (checkout.status === BillingCheckoutStatus.REVIEW_REQUIRED)
      throw reviewRequired();
    if (checkout.status === BillingCheckoutStatus.CREATING) {
      // An old reservation may belong to a crashed request. Never steal its slot.
      if (Date.now() - checkout.createdAt.getTime() > 60_000)
        throw reviewRequired();
      return checkoutResult(checkout, 'preparing');
    }
    if (!checkout.paddleTransactionId) throw reviewRequired();

    let remote: Transaction;
    try {
      remote = await client.transactions.get(checkout.paddleTransactionId);
    } catch {
      // Includes 404: lack of a response is not proof that a payment is canceled.
      throw new BadGatewayException(
        'Mevcut ödeme kontrol edilemedi. Yeni ödeme oluşturulmadı; lütfen tekrar deneyin.',
      );
    }

    const result = await this.withWorkspaceLock(
      input.workspaceId,
      async (tx) => {
        const current = await tx.billingCheckout.findUniqueOrThrow({
          where: { id: checkout.id },
        });
        if (current.status === BillingCheckoutStatus.COMPLETED) {
          return checkoutResult(
            current,
            sameSelection(current, priceId)
              ? 'payment_pending'
              : 'plan_conflict',
          );
        }
        if (current.status !== BillingCheckoutStatus.OPEN)
          throw reviewRequired();
        if (remote.id !== current.paddleTransactionId) throw reviewRequired();
        if (
          remote.status === 'canceled' &&
          !remote.subscriptionId &&
          !current.boundAt
        ) {
          await tx.billingCheckout.update({
            where: { id: current.id },
            data: { status: BillingCheckoutStatus.CANCELED },
          });
          return null;
        }
        const subscription = await tx.billingSubscription.findUniqueOrThrow({
          where: { workspaceId: input.workspaceId },
        });
        assertNoActiveSubscription(subscription);
        validateTransaction(current, remote);
        if (
          current.plan === input.plan &&
          current.cycle === input.cycle &&
          !sameSelection(current, priceId)
        ) {
          // The configured price changed, not the user's selection. Do not send
          // the user back to the same URL or silently replace the payable price.
          throw reviewRequired();
        }
        if (!sameSelection(current, priceId))
          return checkoutResult(current, 'plan_conflict');
        if (
          remote.subscriptionId ||
          remote.status === 'paid' ||
          remote.status === 'completed' ||
          remote.status === 'billed' ||
          remote.status === 'past_due'
        ) {
          return checkoutResult(current, 'payment_pending');
        }
        if (remote.status !== 'draft' && remote.status !== 'ready')
          throw reviewRequired();
        return checkoutResult(current, 'ready');
      },
    );

    // Only a positively confirmed cancellation frees the workspace for another checkout.
    return result ?? this.createOrReuse(input, client);
  }

  async cancelPending(
    workspaceId: string,
    client: Paddle,
  ): Promise<CancelCheckoutResult> {
    const environment = paddleCheckoutEnvironment();
    const checkout = await this.withWorkspaceLock(workspaceId, (tx) =>
      tx.billingCheckout.findFirst({
        where: {
          workspaceId,
          status: { in: PENDING_STATUSES },
        },
      }),
    );

    if (!checkout) return { canceled: false, transactionId: null };
    if (
      checkout.environment !== environment ||
      checkout.status !== BillingCheckoutStatus.OPEN ||
      !checkout.paddleTransactionId ||
      checkout.boundAt
    ) {
      throw reviewRequired();
    }

    let remote: Transaction;
    try {
      remote = await client.transactions.get(checkout.paddleTransactionId);
      if (remote.id !== checkout.paddleTransactionId) throw reviewRequired();

      if (
        remote.subscriptionId ||
        remote.status === 'paid' ||
        remote.status === 'completed' ||
        remote.status === 'billed' ||
        remote.status === 'past_due'
      ) {
        throw checkoutPaymentPending();
      }
      if (remote.status !== 'canceled') {
        if (remote.status !== 'draft' && remote.status !== 'ready')
          throw reviewRequired();
        remote = await client.transactions.update(
          checkout.paddleTransactionId,
          {
            status: 'canceled',
          },
        );
      }
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(
        `Paddle transaction ${checkout.paddleTransactionId} could not be canceled safely.`,
      );
      throw new ServiceUnavailableException({
        code: 'PADDLE_CHECKOUT_CANCEL_FAILED',
        message:
          'Bekleyen ödemeniz Paddle üzerinde iptal edilemedi. Eski ödeme açık kalabileceği için yeni işlem oluşturulmadı; lütfen tekrar deneyin.',
      });
    }

    if (
      remote.id !== checkout.paddleTransactionId ||
      remote.status !== 'canceled' ||
      remote.subscriptionId
    ) {
      throw reviewRequired();
    }

    return this.withWorkspaceLock(workspaceId, async (tx) => {
      const current = await tx.billingCheckout.findUniqueOrThrow({
        where: { id: checkout.id },
      });
      if (current.status === BillingCheckoutStatus.CANCELED) {
        return {
          canceled: true,
          transactionId: current.paddleTransactionId,
        };
      }
      if (
        current.status !== BillingCheckoutStatus.OPEN ||
        current.paddleTransactionId !== remote.id ||
        current.boundAt
      ) {
        throw checkoutPaymentPending();
      }
      const canceled = await tx.billingCheckout.updateMany({
        where: {
          id: current.id,
          status: BillingCheckoutStatus.OPEN,
          paddleTransactionId: remote.id,
          boundAt: null,
        },
        data: { status: BillingCheckoutStatus.CANCELED },
      });
      if (canceled.count !== 1) throw reviewRequired();
      return { canceled: true, transactionId: remote.id };
    });
  }

  private async createTransaction(checkout: Checkout, client: Paddle) {
    let remote: Transaction;
    try {
      remote = await client.transactions.create({
        items: [{ priceId: checkout.paddlePriceId, quantity: 1 }],
        customerId: checkout.expectedPaddleCustomerId ?? undefined,
        customData: {
          // Diagnostic reference, never used to authorize webhook bindings.
          coreassist_checkout_id: checkout.id,
          coreassist_workspace_id: checkout.workspaceId,
          coreassist_plan: checkout.plan,
          coreassist_cycle: checkout.cycle,
        },
      });
    } catch (error) {
      // Paddle has no general client-supplied idempotency key. Ambiguous failures
      // need reconciliation, not another POST /transactions on the next retry.
      const definitelyRejected = isDefiniteRejection(error);
      await this.prisma.billingCheckout.updateMany({
        where: { id: checkout.id, status: BillingCheckoutStatus.CREATING },
        data: {
          status: definitelyRejected
            ? BillingCheckoutStatus.FAILED
            : BillingCheckoutStatus.REVIEW_REQUIRED,
        },
      });
      this.logger.error(
        `Paddle checkout ${checkout.id} creation failed; ${definitelyRejected ? 'request rejected' : 'reconciliation required'}.`,
      );
      if (!definitelyRejected) throw reviewRequired();
      throw new BadGatewayException(
        'Paddle ödeme isteğini kabul etmedi. Lütfen daha sonra tekrar deneyin.',
      );
    }

    try {
      const saved = await this.withWorkspaceLock(
        checkout.workspaceId,
        async (tx) => {
          const claimed = await tx.billingCheckout.updateMany({
            where: {
              id: checkout.id,
              status: BillingCheckoutStatus.CREATING,
              paddleTransactionId: null,
            },
            data: {
              paddleTransactionId: remote.id,
              status: BillingCheckoutStatus.OPEN,
            },
          });
          if (claimed.count !== 1) throw reviewRequired();
          return tx.billingCheckout.findUniqueOrThrow({
            where: { id: checkout.id },
          });
        },
      );
      validateTransaction(saved, remote);
      if (remote.status !== 'draft' && remote.status !== 'ready')
        throw reviewRequired();
      return checkoutResult(saved, 'ready');
    } catch (error) {
      // Keep the committed reservation even when storing the Paddle response fails.
      // Logging these non-secret IDs permits an operator to reconcile safely.
      this.logger.error(
        `Paddle checkout ${checkout.id}, transaction ${remote.id}: response requires verification.`,
      );
      throw error instanceof ConflictException ? error : reviewRequired();
    }
  }

  private withWorkspaceLock<T>(
    workspaceId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
      return work(tx);
    });
  }
}

function assertNoActiveSubscription(subscription: {
  paddleSubscriptionId: string | null;
  status: BillingSubscriptionStatus;
}) {
  // An EXPIRED local trial does not prove a Paddle subscription is canceled.
  if (
    subscription.paddleSubscriptionId &&
    subscription.status !== BillingSubscriptionStatus.CANCELED
  ) {
    throw new ConflictException({
      code: 'PADDLE_SUBSCRIPTION_ALREADY_EXISTS',
      message:
        'Bu çalışma alanının aboneliği bulunuyor. Plan ve ödeme işlemlerine abonelik yönetiminden devam edin.',
    });
  }
}

function sameSelection(checkout: Checkout, priceId: string) {
  return checkout.paddlePriceId === priceId;
}

function validateTransaction(checkout: Checkout, remote: Transaction) {
  const item = remote.items[0];
  if (
    remote.items.length !== 1 ||
    item?.quantity !== 1 ||
    item.price?.id !== checkout.paddlePriceId ||
    item.price.billingCycle?.frequency !== 1 ||
    item.price.billingCycle.interval !==
      (checkout.cycle === BillingCycle.MONTHLY ? 'month' : 'year') ||
    (checkout.expectedPaddleCustomerId &&
      remote.customerId !== checkout.expectedPaddleCustomerId)
  )
    throw reviewRequired();
}

function checkoutResult(
  checkout: Checkout,
  state: CheckoutState,
): CheckoutResult {
  return {
    state,
    transactionId: checkout.paddleTransactionId,
    environment:
      checkout.environment === PaddleEnvironment.PRODUCTION
        ? ('production' as const)
        : ('sandbox' as const),
    plan: checkout.plan,
    cycle: checkout.cycle,
    canCancel:
      state === 'plan_conflict' &&
      checkout.status === BillingCheckoutStatus.OPEN &&
      !checkout.boundAt,
  };
}

function checkoutPaymentPending() {
  return new ConflictException({
    code: 'PADDLE_CHECKOUT_PAYMENT_PENDING',
    message:
      'Ödeme işlemi başlamış veya tamamlanmış görünüyor. Abonelik bilgileri güncellenene kadar bu işlem iptal edilemez.',
  });
}

function reviewRequired() {
  return new ConflictException({
    code: 'PADDLE_CHECKOUT_REVIEW_REQUIRED',
    message:
      'Önceki ödeme işleminin durumu doğrulanamadı. Mükerrer ödeme oluşmaması için yeni işlem açılmadı. Lütfen destek ile iletişime geçin.',
  });
}

function isDefiniteRejection(error: unknown) {
  if (!(error instanceof ApiError) || error.type !== 'request_error')
    return false;
  return [
    'bad_request',
    'authentication_failed',
    'forbidden',
    'not_found',
    'transaction_default_checkout_url_not_set',
    'transaction_checkout_not_enabled',
    'too_many_requests',
  ].includes(String(error.code));
}
