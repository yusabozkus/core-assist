import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  EventName,
  Paddle,
  type EventEntity,
  type SubscriptionNotification,
  type Subscription,
  type Transaction,
  type TransactionNotification,
} from '@paddle/paddle-node-sdk';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingCycle,
  BillingPlan,
  BillingSubscriptionStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingAuthorizationService } from './billing-authorization.service';
import { PaddleCheckoutBindingService } from './paddle-checkout-binding.service';
import { PaddleCheckoutService } from './paddle-checkout.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PENDING_PLAN_CHANGE_STATUSES } from './billing-plan-change.policy';
import { hasBillingAccess } from './billing-access.policy';
import {
  paddleEnvironment,
  paddleCheckoutEnvironment,
  paddlePlanForPrice,
  requirePaddleApiKey,
  requirePaddleWebhookSecret,
} from './paddle-billing.config';

const SUBSCRIPTION_EVENTS = new Set<string>([
  EventName.SubscriptionCreated,
  EventName.SubscriptionUpdated,
  EventName.SubscriptionActivated,
  EventName.SubscriptionTrialing,
  EventName.SubscriptionPastDue,
  EventName.SubscriptionPaused,
  EventName.SubscriptionResumed,
  EventName.SubscriptionCanceled,
]);

const TRANSACTION_RECOVERY_EVENTS = new Set<string>([
  EventName.TransactionCreated,
  EventName.TransactionReady,
  EventName.TransactionCompleted,
]);

@Injectable()
export class PaddleBillingService {
  private readonly logger = new Logger(PaddleBillingService.name);
  private client: Paddle | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: BillingSubscriptionService,
    private readonly checkoutBindings: PaddleCheckoutBindingService,
    private readonly checkouts: PaddleCheckoutService,
    private readonly authorization: BillingAuthorizationService,
    private readonly notifications: NotificationsService,
  ) {}

  async createCheckout(
    workspaceId: string,
    userId: string,
    plan: BillingPlan,
    cycle: BillingCycle,
  ) {
    await this.getManageableSubscription(workspaceId, userId);
    return this.checkouts.createOrReuse(
      { workspaceId, userId, plan, cycle },
      this.getClient(),
    );
  }

  async cancelPendingCheckout(workspaceId: string, userId: string) {
    await this.getManageableSubscription(workspaceId, userId);
    return this.checkouts.cancelPending(workspaceId, this.getClient());
  }

  async getBillingHistory(workspaceId: string, userId: string) {
    const { subscription } = await this.getManageableSubscription(
      workspaceId,
      userId,
    );

    if (!subscription.paddleCustomerId) {
      return {
        managedByPaddle: false,
        paymentMethod: null,
        billingCustomer: null,
        invoices: [],
      };
    }

    try {
      const collection = this.getClient().transactions.list({
        customerId: [subscription.paddleCustomerId],
        status: ['completed'],
        include: [
          'address',
          'business',
          'customer',
          'adjustment',
          'adjustments_totals',
        ],
        perPage: 30,
      });
      const transactions: Transaction[] = [];
      for await (const transaction of collection) {
        transactions.push(transaction);
      }
      transactions.sort(
        (left, right) =>
          Date.parse(right.billedAt ?? right.updatedAt) -
          Date.parse(left.billedAt ?? left.updatedAt),
      );
      const latestTransaction = transactions[0] ?? null;

      return {
        managedByPaddle: true,
        paymentMethod: latestTransaction
          ? paymentMethodFromTransaction(latestTransaction)
          : null,
        billingCustomer: latestTransaction
          ? billingCustomerFromTransaction(latestTransaction)
          : null,
        invoices: transactions.map(mapTransactionToInvoice),
      };
    } catch (error) {
      this.logger.error(
        'Paddle billing history could not be loaded.',
        error instanceof Error ? error.message : undefined,
      );
      throw new BadGatewayException(
        'Fatura geçmişi şu anda alınamıyor. Lütfen tekrar deneyin.',
      );
    }
  }

  async getInvoicePdf(
    workspaceId: string,
    userId: string,
    transactionId: string,
  ) {
    const { subscription } = await this.getManageableSubscription(
      workspaceId,
      userId,
    );

    if (!subscription.paddleCustomerId) {
      throw new NotFoundException('Fatura bulunamadı.');
    }

    try {
      const transaction =
        await this.getClient().transactions.get(transactionId);
      if (transaction.customerId !== subscription.paddleCustomerId) {
        throw new NotFoundException('Fatura bulunamadı.');
      }

      const invoice =
        await this.getClient().transactions.getInvoicePDF(transactionId);
      return { url: invoice.url };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(
        `Paddle invoice ${transactionId} could not be loaded.`,
        error instanceof Error ? error.message : undefined,
      );
      throw new BadGatewayException(
        'Fatura belgesi şu anda alınamıyor. Lütfen tekrar deneyin.',
      );
    }
  }

  async createPortalSession(workspaceId: string, userId: string) {
    const { subscription } = await this.getManageableSubscription(
      workspaceId,
      userId,
    );

    if (!subscription.paddleCustomerId || !subscription.paddleSubscriptionId) {
      throw new ConflictException(
        'Paddle tarafından yönetilen aktif bir abonelik bulunmuyor.',
      );
    }

    try {
      const session = await this.getClient().customerPortalSessions.create(
        subscription.paddleCustomerId,
        [subscription.paddleSubscriptionId],
      );
      const subscriptionUrls = session.urls.subscriptions.find(
        (item) => item.id === subscription.paddleSubscriptionId,
      );

      return {
        overviewUrl: session.urls.general.overview,
        updatePaymentMethodUrl:
          subscriptionUrls?.updateSubscriptionPaymentMethod ?? null,
        cancelSubscriptionUrl: subscriptionUrls?.cancelSubscription ?? null,
      };
    } catch (error) {
      this.logger.error(
        'Paddle customer portal session could not be created.',
        error instanceof Error ? error.message : undefined,
      );
      throw new BadGatewayException(
        'Abonelik yönetimi şu anda açılamıyor. Lütfen tekrar deneyin.',
      );
    }
  }

  async refreshSubscriptionState(workspaceId: string, userId: string) {
    await this.getManageableSubscription(workspaceId, userId);
    await this.reconcileWorkspace(workspaceId);

    const subscription =
      await this.prisma.billingSubscription.findUniqueOrThrow({
        where: { workspaceId },
        select: {
          status: true,
          cancelAtPeriodEnd: true,
          scheduledAccessEndsAt: true,
          currentPeriodEnd: true,
        },
      });

    return { refreshed: true, subscription };
  }

  async verifyWebhook(rawBody: string, signature: string | undefined) {
    if (!signature) {
      throw new BadRequestException('Paddle-Signature başlığı eksik.');
    }

    let event: EventEntity;
    try {
      event = await this.getClient().webhooks.unmarshal(
        rawBody,
        requirePaddleWebhookSecret(),
        signature,
      );
    } catch {
      throw new BadRequestException('Paddle webhook imzası doğrulanamadı.');
    }

    if (!event.eventId?.trim() || !event.eventType?.trim()) {
      throw new BadRequestException('Paddle olay kimliği veya türü eksik.');
    }
    if (!parseDate(event.occurredAt)) {
      throw new BadRequestException('Paddle olayının tarihi geçersiz.');
    }

    return event;
  }

  async processVerifiedWebhook(event: EventEntity) {
    try {
      if (!event.eventId?.trim() || !event.eventType?.trim()) {
        throw new BadRequestException('Paddle olay kimliği veya türü eksik.');
      }
      const occurredAt = parseDate(event.occurredAt);
      if (!occurredAt) {
        // Never give an undated event a fresh timestamp and let it overwrite state.
        throw new BadRequestException('Paddle olayının tarihi geçersiz.');
      }

      const result = await this.prisma.$transaction(async (transaction) => {
        // Only THIS table's event ID conflict is a duplicate. A P2002 from a
        // customer/subscription/checkout constraint must still fail the event.
        // Concurrent deliveries wait for this transaction: rollback makes the
        // same ID available for retry; commit makes later deliveries duplicates.
        const claimed = await transaction.$queryRaw<Array<{ id: string }>>`
          INSERT INTO "billing_webhook_event" ("id", "eventType", "occurredAt")
          VALUES (${event.eventId}, ${event.eventType}, ${occurredAt})
          ON CONFLICT ("id") DO NOTHING
          RETURNING "id"
        `;
        if (claimed.length === 0) {
          return { received: true, processed: false, duplicate: true };
        }

        if (SUBSCRIPTION_EVENTS.has(event.eventType)) {
          const data = event.data as SubscriptionNotification;
          const closedAccount =
            data.id && data.customerId
              ? await transaction.billingClosureRecord.findFirst({
                  where: {
                    environment: paddleCheckoutEnvironment(),
                    paddleSubscriptionIds: { has: data.id },
                    paddleCustomerIds: { has: data.customerId },
                  },
                  select: { id: true, closedAt: true },
                })
              : null;
          if (closedAccount) {
            if (
              data.status !== 'canceled' &&
              occurredAt > closedAccount.closedAt
            ) {
              throw new ConflictException({
                code: 'PADDLE_CLOSED_ACCOUNT_ACTIVITY',
                message:
                  'Silinen hesaba ait abonelikte beklenmeyen yeni hareket var; inceleme gerekiyor.',
              });
            }
            // This subscription was remotely verified as terminal before the
            // account was deleted. Delayed events never resurrect its access.
            return { received: true, processed: false, ignored: true };
          }
          const notificationChange = await this.syncSubscription(
            transaction,
            data,
            occurredAt,
            event.eventType === EventName.SubscriptionCreated
              ? event.data.transactionId
              : undefined,
          );
          return { received: true, processed: true, notificationChange };
        }

        if (TRANSACTION_RECOVERY_EVENTS.has(event.eventType)) {
          const recovered = await this.checkoutBindings.recoverTransaction(
            transaction,
            event.data as TransactionNotification,
          );
          if (recovered) {
            return {
              received: true,
              processed: recovered.recovered,
              recovered: recovered.recovered,
            };
          }
        }

        // Transaction notifications are recorded/deduplicated, but never grant
        // or revoke subscription access. Created/ready/completed events only
        // recover a transaction ID lost between Paddle's response and our DB
        // write. Subscription events/snapshots remain authoritative for access.

        return { received: true, processed: false, ignored: true };
      });
      if ('notificationChange' in result) {
        if (result.notificationChange) {
          this.notifications.emitBillingChange(
            result.notificationChange.recipientUserIds,
            result.notificationChange.reason,
          );
        }
        return { received: true, processed: true };
      }
      return result;
    } catch (error) {
      // No processed marker survives a failed transaction. Log identifiers and
      // safe error codes, never the payload, signature, or raw database error.
      this.logger.error({
        message: 'Paddle webhook processing failed; delivery can be retried.',
        eventId: event.eventId,
        eventType: event.eventType,
        ...webhookFailureDetails(error),
      });
      if (error instanceof HttpException) throw error;

      throw new ServiceUnavailableException({
        code: 'PADDLE_WEBHOOK_PROCESSING_FAILED',
        message: 'Paddle olayı işlenemedi. Aynı olay yeniden gönderilebilir.',
        eventId: event.eventId,
      });
    }
  }

  // Uses only server-stored IDs. Read-only Paddle calls happen outside DB locks.
  async reconcileWorkspace(workspaceId: string) {
    const baseline = await this.prisma.billingSubscription.findUniqueOrThrow({
      where: { workspaceId },
    });
    const checkout = await this.prisma.billingCheckout.findFirst({
      where: {
        workspaceId,
        environment: paddleCheckoutEnvironment(),
        status: 'OPEN',
        paddleTransactionId: { not: null },
        boundAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    let subscriptionId = baseline.paddleSubscriptionId;
    let initialTransactionId: string | undefined;
    if (checkout?.paddleTransactionId) {
      const payment = await boundedRecoveryRead(
        this.getClient().transactions.get(checkout.paddleTransactionId),
      );
      if (payment.status === 'completed' && payment.subscriptionId) {
        // Binding validation below checks expected customer, exact recurring
        // price and prior subscription before allowing initial activation.
        subscriptionId = payment.subscriptionId;
        initialTransactionId = payment.id;
      }
    }
    if (!subscriptionId) return;
    const snapshot = await boundedRecoveryRead(
      this.getClient().subscriptions.get(subscriptionId),
    );
    if (snapshot.id !== subscriptionId)
      throw new ConflictException('Paddle abonelik kimliği eşleşmedi.');
    const notificationChange = await this.prisma.$transaction((transaction) =>
      this.syncSubscription(
        transaction,
        snapshot,
        parseDate(snapshot.updatedAt) ?? new Date(0),
        initialTransactionId,
        {
          workspaceId,
          expectedUpdatedAt: baseline.updatedAt,
        },
      ),
    );
    if (notificationChange) {
      this.notifications.emitBillingChange(
        notificationChange.recipientUserIds,
        notificationChange.reason,
      );
    }
  }

  private async syncSubscription(
    transaction: Prisma.TransactionClient,
    data: SubscriptionNotification | Subscription,
    occurredAt: Date,
    initialTransactionId?: string,
    reconciliation?: { workspaceId: string; expectedUpdatedAt: Date },
  ) {
    const {
      subscription: existing,
      selection,
      priceId,
    } = await this.checkoutBindings.resolve(transaction, {
      paddleSubscriptionId: data.id,
      paddleTransactionId: initialTransactionId,
      paddleCustomerId: data.customerId,
      items: data.items,
    });

    if (
      reconciliation &&
      (existing.workspaceId !== reconciliation.workspaceId ||
        existing.updatedAt.getTime() !==
          reconciliation.expectedUpdatedAt.getTime())
    ) {
      // Throw (rather than return) to roll back any initial checkout binding.
      throw new ConflictException({
        code: 'PADDLE_RECONCILE_RACE',
        message:
          'Abonelik kontrol sırasında değişti; yeniden kontrol edilecek.',
      });
    }
    const snapshotAt = parseDate(data.updatedAt);
    if (!snapshotAt)
      throw new BadRequestException(
        'Paddle abonelik güncelleme tarihi geçersiz.',
      );

    const currentPeriod = data.currentBillingPeriod;
    const status = mapPaddleStatus(data.status);
    if (!status) {
      throw new BadRequestException('Paddle abonelik durumu geçersiz.');
    }
    if (
      status === BillingSubscriptionStatus.ACTIVE ||
      status === BillingSubscriptionStatus.TRIALING
    ) {
      const start = parseDate(currentPeriod?.startsAt);
      const end = parseDate(currentPeriod?.endsAt);
      if (!start || !end || end <= start)
        throw new BadRequestException('Paddle abonelik dönemi geçersiz.');
    }

    const incomingHasBillingAccess = hasBillingAccess({
      status,
      currentPeriodEnd:
        parseDate(currentPeriod?.endsAt) ?? existing.currentPeriodEnd,
      trialEndsAt:
        status === BillingSubscriptionStatus.TRIALING
          ? (parseDate(currentPeriod?.endsAt) ?? existing.trialEndsAt)
          : null,
      paddleSubscriptionId: data.id,
      cancelAtPeriodEnd: data.scheduledChange?.action === 'cancel',
      scheduledAccessEndsAt:
        data.scheduledChange?.action === 'cancel' ||
        data.scheduledChange?.action === 'pause'
          ? parseDate(data.scheduledChange.effectiveAt)
          : null,
    });

    const existingHealthyNotificationChange =
      existing.paddleSubscriptionId === data.id &&
      hasBillingAccess(existing) &&
      incomingHasBillingAccess
        ? {
            recipientUserIds: await this.notifications.resolveBillingIssues(
              transaction,
              existing.workspaceId,
            ),
            reason: 'READ_ALL' as const,
          }
        : undefined;

    // Before the snapshot-version migration, only the event envelope time was
    // stored. An older API snapshot may bootstrap its version only when the
    // access-critical state agrees; it must not regress a newer legacy event.
    if (
      reconciliation &&
      !existing.paddleSnapshotAt &&
      existing.paddleSubscriptionId === data.id &&
      existing.paddleUpdatedAt &&
      snapshotAt < existing.paddleUpdatedAt
    ) {
      if (
        existing.status !== status ||
        existing.paddlePriceId !== priceId ||
        existing.currentPeriodEnd.getTime() !==
          parseDate(currentPeriod?.endsAt)?.getTime() ||
        existing.cancelAtPeriodEnd !==
          (data.scheduledChange?.action === 'cancel')
      )
        return existingHealthyNotificationChange;
    }

    // resolve() locks the workspace and re-reads the subscription. The lock is
    // retained until this update and the webhook event record commit together.
    const previousVersion =
      existing.paddleSnapshotAt ??
      (!reconciliation ? existing.paddleUpdatedAt : null);
    const incomingVersion =
      existing.paddleSnapshotAt || reconciliation ? snapshotAt : occurredAt;
    if (existing.paddleSubscriptionId === data.id && previousVersion) {
      if (previousVersion > incomingVersion)
        return existingHealthyNotificationChange;
      if (
        previousVersion.getTime() === incomingVersion.getTime() &&
        subscriptionStatusPriority(status) <=
          subscriptionStatusPriority(existing.status)
      )
        return existingHealthyNotificationChange;
      // Exact timestamp ties favor the more restrictive status, irrespective
      // of delivery order. Duplicate/equally ranked snapshots are not reapplied.
    }

    // Paddle cancellations are terminal. A new subscription can only replace
    // this ID through the independently validated checkout binding.
    if (
      existing.paddleSubscriptionId === data.id &&
      existing.status === BillingSubscriptionStatus.CANCELED &&
      status !== BillingSubscriptionStatus.CANCELED
    )
      return;

    await transaction.billingSubscription.update({
      where: { id: existing.id },
      data: {
        plan: selection.plan,
        cycle: selection.cycle,
        status,
        paddleCustomerId: data.customerId,
        paddleSubscriptionId: data.id,
        paddlePriceId: priceId,
        currentPeriodStart:
          parseDate(currentPeriod?.startsAt) ?? existing.currentPeriodStart,
        currentPeriodEnd:
          parseDate(currentPeriod?.endsAt) ?? existing.currentPeriodEnd,
        trialEndsAt:
          status === BillingSubscriptionStatus.TRIALING
            ? (parseDate(currentPeriod?.endsAt) ?? existing.trialEndsAt)
            : null,
        cancelAtPeriodEnd: data.scheduledChange?.action === 'cancel',
        scheduledAccessEndsAt:
          data.scheduledChange?.action === 'cancel' ||
          data.scheduledChange?.action === 'pause'
            ? parseDate(data.scheduledChange.effectiveAt)
            : null,
        canceledAt: parseDate(data.canceledAt),
        paddleUpdatedAt:
          existing.paddleSubscriptionId === data.id &&
          existing.paddleUpdatedAt &&
          existing.paddleUpdatedAt > occurredAt
            ? existing.paddleUpdatedAt
            : occurredAt,
        paddleSnapshotAt: snapshotAt,
        // A plan/cycle change must not grant another monthly AI quota. Retain
        // the meter anchor for the lifetime of this paid subscription.
        usagePeriodAnchor:
          existing.paddleSubscriptionId === data.id &&
          existing.usagePeriodAnchor
            ? existing.usagePeriodAnchor
            : status === BillingSubscriptionStatus.ACTIVE
              ? (parseDate(currentPeriod?.startsAt) ??
                existing.currentPeriodStart)
              : null,
      },
    });
    if (status === BillingSubscriptionStatus.ACTIVE) {
      await transaction.billingPlanChange.updateMany({
        where: {
          workspaceId: existing.workspaceId,
          paddleSubscriptionId: data.id,
          paddleCustomerId: data.customerId,
          targetPriceId: priceId,
          environment: paddleCheckoutEnvironment(),
          status: { in: PENDING_PLAN_CHANGE_STATUSES },
          sourceUpdatedAt: { lt: occurredAt },
        },
        data: {
          status: 'COMPLETED',
          completedAt: occurredAt,
          failureCode: null,
          retryAfterSeconds: null,
          retryAt: null,
        },
      });
    } else if (status === BillingSubscriptionStatus.CANCELED) {
      await transaction.billingPlanChange.updateMany({
        where: {
          workspaceId: existing.workspaceId,
          paddleSubscriptionId: data.id,
          status: { in: PENDING_PLAN_CHANGE_STATUSES },
          sourceUpdatedAt: { lt: occurredAt },
        },
        data: {
          status: 'FAILED',
          failureCode: 'SUBSCRIPTION_ENDED',
          retryAfterSeconds: null,
          retryAt: null,
        },
      });
    }
    if (status === BillingSubscriptionStatus.PAST_DUE) {
      const recipientUserIds = await this.notifications.createBillingIssue(
        transaction,
        existing.workspaceId,
        {
          title: 'Abonelik ödemeniz tamamlanamadı',
          message:
            'Paddle yenileme ödemesinde sorun bildirdi. Ödeme yönteminizi Plan ve faturalar bölümünden güncelleyin. AI ve senkronizasyon durduruldu; mevcut soruları manuel yanıtlayabilirsiniz.',
          dedupeKey: `billing-payment:${data.id}:${currentPeriod?.startsAt ?? snapshotAt.toISOString()}`,
        },
      );
      return { recipientUserIds, reason: 'CREATED' as const };
    }
    if (incomingHasBillingAccess) {
      if (existingHealthyNotificationChange)
        return existingHealthyNotificationChange;
      const recipientUserIds = await this.notifications.resolveBillingIssues(
        transaction,
        existing.workspaceId,
      );
      return { recipientUserIds, reason: 'READ_ALL' as const };
    }
  }

  private getClient() {
    this.client ??= new Paddle(requirePaddleApiKey(), {
      environment: paddleEnvironment(),
    });
    return this.client;
  }

  private async getManageableSubscription(workspaceId: string, userId: string) {
    await this.authorization.requireWorkspaceAccess(workspaceId, userId);

    return {
      workspaceId,
      subscription:
        await this.subscriptions.getOrCreateForWorkspace(workspaceId),
    };
  }
}

// The installed SDK has no request timeout option. Stop waiting on read-only
// recovery calls; a late GET response cannot proceed to subscription writes.
async function boundedRecoveryRead<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ServiceUnavailableException('Paddle kontrol süresi aşıldı.'),
            ),
          15_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mapTransactionToInvoice(transaction: Transaction) {
  const totals = transaction.details?.totals;
  const currency = totals?.currencyCode ?? transaction.currencyCode;
  const total = moneyFromMinorUnits(totals?.grandTotal ?? '0', currency);
  const refundedAmount = moneyFromMinorUnits(
    transaction.adjustmentsTotals?.breakdown?.refund ?? '0',
    currency,
  );
  const selection = paddlePlanForPrice(
    transaction.items.find((item) => item.price?.id)?.price?.id,
  );
  const billingCustomer = billingCustomerFromTransaction(transaction);
  const paymentMethod = paymentMethodFromTransaction(transaction);

  return {
    id: transaction.id,
    transactionId: transaction.id,
    number:
      transaction.invoiceNumber ??
      `PDL-${transaction.id.slice(-8).toUpperCase()}`,
    plan: selection?.plan ?? null,
    cycle: selection?.cycle ?? null,
    periodStart: transaction.billingPeriod?.startsAt ?? null,
    periodEnd: transaction.billingPeriod?.endsAt ?? null,
    issuedAt:
      transaction.billedAt ?? transaction.updatedAt ?? transaction.createdAt,
    subtotal: moneyFromMinorUnits(totals?.subtotal ?? '0', currency),
    tax: moneyFromMinorUnits(totals?.tax ?? '0', currency),
    total,
    refundedAmount,
    currency,
    status:
      refundedAmount >= total && total > 0
        ? ('refunded' as const)
        : refundedAmount > 0
          ? ('partially_refunded' as const)
          : ('paid' as const),
    paymentMethod,
    billingCustomer,
  };
}

function paymentMethodFromTransaction(transaction: Transaction) {
  const payment =
    transaction.payments.find((item) => item.status === 'captured') ??
    transaction.payments.at(-1);
  const details = payment?.methodDetails;
  if (!details) return null;

  if (details.card) {
    return {
      type: 'card' as const,
      brand: details.card.type,
      last4: details.card.last4,
      expiryMonth: details.card.expiryMonth,
      expiryYear: details.card.expiryYear,
    };
  }

  return {
    type: details.type,
    brand: null,
    last4: null,
    expiryMonth: null,
    expiryYear: null,
  };
}

function billingCustomerFromTransaction(transaction: Transaction) {
  if (!transaction.customer && !transaction.business && !transaction.address) {
    return null;
  }

  const address = transaction.address;
  return {
    name: transaction.business?.name ?? transaction.customer?.name ?? null,
    email: transaction.customer?.email ?? null,
    taxIdentifier: transaction.business?.taxIdentifier ?? null,
    address: address
      ? [
          address.firstLine,
          address.secondLine,
          address.city,
          address.region,
          address.postalCode,
          address.countryCode,
        ]
          .filter(Boolean)
          .join(', ')
      : null,
  };
}

function moneyFromMinorUnits(value: string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.abs(amount) / (ZERO_DECIMAL_CURRENCIES.has(currency) ? 1 : 100);
}

const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW']);

function mapPaddleStatus(status: SubscriptionNotification['status']) {
  switch (status) {
    case 'active':
      return BillingSubscriptionStatus.ACTIVE;
    case 'trialing':
      return BillingSubscriptionStatus.TRIALING;
    case 'past_due':
      return BillingSubscriptionStatus.PAST_DUE;
    case 'paused':
      return BillingSubscriptionStatus.PAUSED;
    case 'canceled':
      return BillingSubscriptionStatus.CANCELED;
  }
}

function subscriptionStatusPriority(status: BillingSubscriptionStatus) {
  switch (status) {
    case BillingSubscriptionStatus.CANCELED:
      return 5;
    case BillingSubscriptionStatus.PAUSED:
      return 4;
    case BillingSubscriptionStatus.PAST_DUE:
      return 3;
    case BillingSubscriptionStatus.EXPIRED:
      return 2;
    case BillingSubscriptionStatus.TRIALING:
      return 1;
    case BillingSubscriptionStatus.ACTIVE:
      return 0;
  }
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function webhookFailureDetails(error: unknown) {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    const code =
      typeof response === 'object' && 'code' in response ? response.code : null;
    return {
      errorCode:
        typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code)
          ? code
          : `HTTP_${error.getStatus()}`,
    };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    /^P\d{4}$/.test(error.code)
  ) {
    const meta = 'meta' in error ? error.meta : null;
    const target =
      typeof meta === 'object' && meta !== null && 'target' in meta
        ? meta.target
        : null;
    // Prisma unique violations identify the affected fields, not their values.
    const fields = (Array.isArray(target) ? target : [target]).filter(
      (field): field is string =>
        typeof field === 'string' &&
        /^[A-Za-z_][A-Za-z0-9_]{0,99}$/.test(field),
    );
    return { errorCode: error.code, constraintFields: fields };
  }

  return { errorCode: 'PADDLE_WEBHOOK_PROCESSING_FAILED' };
}
