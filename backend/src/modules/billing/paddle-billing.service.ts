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
  ApiError as PaddleApiError,
  EventName,
  Paddle,
  type AdjustmentNotification,
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
  NotificationSeverity,
  NotificationType,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingAuthorizationService } from './billing-authorization.service';
import { PaddleCheckoutBindingService } from './paddle-checkout-binding.service';
import { PaddleCheckoutService } from './paddle-checkout.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  AuditLogService,
  AuditOrigin,
  AuditResult,
  auditErrorCode,
} from '../audit/audit-log.service';
import { PENDING_PLAN_CHANGE_STATUSES } from './billing-plan-change.policy';
import { hasBillingAccess } from './billing-access.policy';
import { ManageSubscriptionDto } from './dto/manage-subscription.dto';
import {
  subscriptionActionCompleted,
  subscriptionManagementState,
} from './subscription-management.policy';
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

const TRANSACTION_EVENTS = new Set<string>([
  EventName.TransactionBilled,
  EventName.TransactionCanceled,
  EventName.TransactionCompleted,
  EventName.TransactionCreated,
  EventName.TransactionPaid,
  EventName.TransactionPastDue,
  EventName.TransactionPaymentFailed,
  EventName.TransactionReady,
  EventName.TransactionRevised,
  EventName.TransactionUpdated,
]);

const ADJUSTMENT_EVENTS = new Set<string>([
  EventName.AdjustmentCreated,
  EventName.AdjustmentUpdated,
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
    private readonly audit: AuditLogService,
  ) {}

  async createCheckout(
    workspaceId: string,
    userId: string,
    plan: BillingPlan,
    cycle: BillingCycle,
  ) {
    await this.getManageableSubscription(workspaceId, userId);
    const auditBase = {
      actorType: AuditActorType.USER,
      actorUserId: userId,
      origin: AuditOrigin.API,
      action: AuditAction.BILLING_CHECKOUT_OPENED,
      workspaceId,
      targetType: 'BILLING_CHECKOUT',
      metadata: { plan, cycle },
    } as const;
    await this.audit.record({ ...auditBase, result: AuditResult.STARTED });
    try {
      const result = await this.checkouts.createOrReuse(
        { workspaceId, userId, plan, cycle },
        this.getClient(),
      );
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.SUCCESS,
        targetId: result.transactionId,
        after: {
          state: result.state,
          plan: result.plan,
          cycle: result.cycle,
          canCancel: result.canCancel,
        },
      });
      return result;
    } catch (error) {
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.FAILURE,
        errorCode: auditErrorCode(error),
      });
      throw error;
    }
  }

  async cancelPendingCheckout(workspaceId: string, userId: string) {
    await this.getManageableSubscription(workspaceId, userId);
    const auditBase = {
      actorType: AuditActorType.USER,
      actorUserId: userId,
      origin: AuditOrigin.API,
      action: AuditAction.BILLING_CHECKOUT_CANCELED,
      workspaceId,
      targetType: 'BILLING_CHECKOUT',
    } as const;
    await this.audit.record({ ...auditBase, result: AuditResult.STARTED });
    try {
      const result = await this.checkouts.cancelPending(
        workspaceId,
        this.getClient(),
      );
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.SUCCESS,
        targetId: result.transactionId,
        after: { canceled: result.canceled },
      });
      return result;
    } catch (error) {
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.FAILURE,
        errorCode: auditErrorCode(error),
      });
      throw error;
    }
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
      const latestTransaction =
        transactions.find(
          (transaction) =>
            transaction.subscriptionId === subscription.paddleSubscriptionId,
        ) ??
        transactions[0] ??
        null;
      const invoices = transactions.filter(
        (transaction) =>
          transaction.origin !== 'subscription_payment_method_change',
      );

      return {
        managedByPaddle: true,
        paymentMethod: latestTransaction
          ? paymentMethodFromTransaction(latestTransaction)
          : null,
        billingCustomer:
          (latestTransaction
            ? billingCustomerFromTransaction(latestTransaction)
            : null) ??
          (invoices[0] ? billingCustomerFromTransaction(invoices[0]) : null),
        invoices: invoices.map(mapTransactionToInvoice),
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

  private async loadSubscriptionManagement(
    workspaceId: string,
    userId: string,
  ) {
    const { subscription } = await this.getManageableSubscription(
      workspaceId,
      userId,
    );
    if (!subscription.paddleSubscriptionId || !subscription.paddleCustomerId) {
      throw new ConflictException(
        'Yönetilecek bir Paddle aboneliği bulunmuyor.',
      );
    }
    let current: Subscription;
    try {
      current = await boundedRecoveryRead(
        this.getClient().subscriptions.get(subscription.paddleSubscriptionId),
      );
    } catch {
      throw new BadGatewayException(
        'Abonelik durumu şu anda doğrulanamıyor. Lütfen tekrar kontrol edin.',
      );
    }
    if (
      current.id !== subscription.paddleSubscriptionId ||
      current.customerId !== subscription.paddleCustomerId
    ) {
      throw new ConflictException('Paddle abonelik bilgileri eşleşmedi.');
    }
    const pendingChange = await this.prisma.billingPlanChange.findFirst({
      where: { workspaceId, status: { in: PENDING_PLAN_CHANGE_STATUSES } },
      select: { id: true },
    });
    return {
      current,
      state: subscriptionManagementState(current, Boolean(pendingChange)),
    };
  }

  async getSubscriptionManagement(workspaceId: string, userId: string) {
    const { state } = await this.loadSubscriptionManagement(
      workspaceId,
      userId,
    );
    return state;
  }

  async manageSubscription(
    workspaceId: string,
    userId: string,
    input: ManageSubscriptionDto,
  ) {
    const { current, state } = await this.loadSubscriptionManagement(
      workspaceId,
      userId,
    );
    if (input.subscriptionId !== current.id) {
      throw new ConflictException(
        'Abonelik değişmiş. Pencereyi kapatıp yeniden açın.',
      );
    }
    // A lost response may be retried, but never repeat an already applied write.
    if (subscriptionActionCompleted(current, input.action)) {
      return this.subscriptionManagementResult(workspaceId, current);
    }
    if (input.updatedAt !== current.updatedAt) {
      throw new ConflictException(
        'Abonelik durumu değişmiş. Güncel durumu kontrol edin.',
      );
    }
    if (state.action !== input.action) {
      throw new ConflictException(
        state.blockedReason ?? 'Bu işlem mevcut abonelik durumuna uygun değil.',
      );
    }
    const auditBase = {
      actorType: AuditActorType.USER,
      actorUserId: userId,
      origin: AuditOrigin.API,
      action:
        input.action === 'cancel'
          ? AuditAction.BILLING_SUBSCRIPTION_CANCEL_REQUESTED
          : AuditAction.BILLING_CANCELLATION_REVERSED,
      workspaceId,
      targetType: 'BILLING_SUBSCRIPTION',
      targetId: current.id,
      before: {
        status: current.status,
        cancellationScheduled: state.cancellationScheduled,
      },
    } as const;
    await this.audit.record({ ...auditBase, result: AuditResult.STARTED });
    let updated: Subscription;
    try {
      updated =
        input.action === 'cancel'
          ? await boundedSubscriptionWrite(
              this.getClient().subscriptions.cancel(current.id, {
                effectiveFrom: 'next_billing_period',
              }),
            )
          : await boundedSubscriptionWrite(
              this.getClient().subscriptions.update(current.id, {
                scheduledChange: null,
              }),
            );
      if (
        updated.id !== current.id ||
        updated.customerId !== current.customerId ||
        !subscriptionActionCompleted(updated, input.action)
      ) {
        throw new Error('Unexpected subscription management response');
      }
    } catch (error) {
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.FAILURE,
        errorCode: auditErrorCode(error),
      });
      if (error instanceof PaddleApiError && error.type === 'request_error') {
        throw new ConflictException({
          code: 'SUBSCRIPTION_CHANGE_REJECTED',
          message:
            'Abonelik değişikliği kabul edilmedi. Güncel durumu kontrol edip tekrar deneyin.',
        });
      }
      // Paddle may have accepted the request even if its response was lost.
      // The client must only GET/check the result, never silently repeat a write.
      throw new BadGatewayException({
        code: 'SUBSCRIPTION_RESULT_UNKNOWN',
        message:
          'İşlem sonucu henüz doğrulanamadı. Yeniden işlem başlatmadan abonelik durumunu kontrol edin.',
      });
    }
    await this.audit.recordSafely({
      ...auditBase,
      result: AuditResult.SUCCESS,
      after: {
        status: updated.status,
        cancellationScheduled: updated.scheduledChange?.action === 'cancel',
      },
    });
    return this.subscriptionManagementResult(workspaceId, updated);
  }

  private async subscriptionManagementResult(
    workspaceId: string,
    current: Subscription,
  ) {
    let synchronized = false;
    try {
      await this.reconcileWorkspace(workspaceId);
      const local = await this.prisma.billingSubscription.findUniqueOrThrow({
        where: { workspaceId },
      });
      synchronized =
        local.paddleSubscriptionId === current.id &&
        local.cancelAtPeriodEnd ===
          (current.scheduledChange?.action === 'cancel') &&
        local.status === mapPaddleStatus(current.status);
    } catch {
      this.logger.warn(
        'Subscription management succeeded; local reconciliation is pending.',
      );
    }
    return {
      completed: true,
      synchronized,
      subscription: subscriptionManagementState(current, false),
    };
  }

  async createPaymentMethodCheckout(workspaceId: string, userId: string) {
    const { subscription } = await this.getManageableSubscription(
      workspaceId,
      userId,
    );
    if (!subscription.paddleSubscriptionId || !subscription.paddleCustomerId) {
      throw new ConflictException(
        'Güncellenecek bir Paddle aboneliği bulunmuyor.',
      );
    }

    try {
      const client = this.getClient();
      // Read Paddle's current status, not the potentially delayed local webhook.
      const current = await boundedRecoveryRead(
        client.subscriptions.get(subscription.paddleSubscriptionId),
      );
      if (
        current.id !== subscription.paddleSubscriptionId ||
        current.customerId !== subscription.paddleCustomerId
      ) {
        throw new ConflictException('Paddle abonelik bilgileri eşleşmedi.');
      }
      if (
        current.collectionMode !== 'automatic' ||
        !['active', 'past_due'].includes(current.status)
      ) {
        throw new ConflictException(
          'Ödeme yöntemi yalnızca aktif veya ödemesi gecikmiş aboneliklerde güncellenebilir.',
        );
      }

      // This prepares a checkout only. Card collection and any overdue payment
      // require the customer to submit Paddle's secure form.
      const transaction = await boundedRecoveryRead(
        client.subscriptions.getPaymentMethodChangeTransaction(current.id),
      );
      const totals = transaction.details?.totals;
      if (
        transaction.subscriptionId !== current.id ||
        transaction.customerId !== current.customerId ||
        transaction.collectionMode !== 'automatic' ||
        !['draft', 'ready', 'past_due'].includes(transaction.status) ||
        !totals ||
        !['subtotal', 'tax', 'total', 'balance'].every((key) => {
          const value = Number(totals[key as keyof typeof totals]);
          return Number.isFinite(value) && value >= 0;
        })
      ) {
        throw new ConflictException('Ödeme güncelleme işlemi doğrulanamadı.');
      }
      const requiresPayment = current.status === 'past_due';
      if (
        !requiresPayment &&
        (transaction.origin !== 'subscription_payment_method_change' ||
          Number(totals.total) !== 0 ||
          Number(totals.balance) !== 0)
      ) {
        throw new ConflictException(
          'Kart güncellemesi için ücretsiz bir işlem oluşturulamadı.',
        );
      }

      const currency = transaction.currencyCode;
      return {
        transactionId: transaction.id,
        requiresPayment,
        currency,
        amountDue: moneyFromMinorUnits(totals.balance, currency),
        subtotal: moneyFromMinorUnits(totals.subtotal, currency),
        tax: moneyFromMinorUnits(totals.tax, currency),
        total: moneyFromMinorUnits(totals.total, currency),
        items: transaction.details.lineItems.map((item) => ({
          name: item.product?.name ?? 'Abonelik',
          quantity: item.quantity,
        })),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        'Paddle payment method checkout could not be prepared.',
      );
      throw new BadGatewayException(
        'Ödeme formu şu anda açılamıyor. Lütfen tekrar deneyin.',
      );
    }
  }

  async getPaymentMethodCheckoutStatus(
    workspaceId: string,
    userId: string,
    transactionId: string,
  ) {
    const { subscription } = await this.getManageableSubscription(
      workspaceId,
      userId,
    );
    if (
      !subscription.paddleSubscriptionId ||
      !subscription.paddleCustomerId ||
      !/^txn_[a-z0-9]{26}$/.test(transactionId)
    ) {
      throw new NotFoundException('Ödeme güncelleme işlemi bulunamadı.');
    }
    try {
      const transaction = await boundedRecoveryRead(
        this.getClient().transactions.get(transactionId),
      );
      if (
        transaction.id !== transactionId ||
        transaction.subscriptionId !== subscription.paddleSubscriptionId ||
        transaction.customerId !== subscription.paddleCustomerId
      ) {
        throw new NotFoundException('Ödeme güncelleme işlemi bulunamadı.');
      }
      return {
        completed: transaction.status === 'completed',
        paymentMethod:
          transaction.status === 'completed'
            ? paymentMethodFromTransaction(transaction)
            : null,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        'Paddle payment method checkout could not be verified.',
      );
      throw new BadGatewayException(
        'Ödeme güncellemesi henüz doğrulanamadı. Lütfen tekrar kontrol edin.',
      );
    }
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

        if (ADJUSTMENT_EVENTS.has(event.eventType)) {
          const notificationChange = await this.syncAdjustment(
            transaction,
            event.data as AdjustmentNotification,
          );
          return {
            received: true,
            processed: Boolean(notificationChange),
            notificationChange,
          };
        }

        if (TRANSACTION_EVENTS.has(event.eventType)) {
          const notification = event.data as TransactionNotification;
          const recovered = TRANSACTION_RECOVERY_EVENTS.has(event.eventType)
            ? await this.checkoutBindings.recoverTransaction(
                transaction,
                notification,
              )
            : null;
          const referenced = await this.recordTransactionReference(
            transaction,
            notification,
            occurredAt,
            recovered?.workspaceId,
          );
          if (recovered) {
            if (recovered.recovered) {
              await this.audit.record(
                {
                  actorType: AuditActorType.SYSTEM,
                  origin: AuditOrigin.WEBHOOK,
                  action: AuditAction.BILLING_TRANSACTION_RECOVERED,
                  result: AuditResult.SUCCESS,
                  workspaceId: recovered.workspaceId,
                  targetType: 'BILLING_CHECKOUT',
                  targetId: recovered.checkoutId,
                  metadata: {
                    eventId: event.eventId,
                    eventType: event.eventType,
                    paddleTransactionId: notification.id,
                  },
                },
                transaction,
              );
            }
            return {
              received: true,
              processed: recovered.recovered || referenced,
              recovered: recovered.recovered,
            };
          }
          if (referenced) {
            return {
              received: true,
              processed: true,
              referenced: true,
            };
          }
        }

        // Transaction notifications never grant or revoke subscription access.
        // They only recover a lost checkout binding and retain minimal searchable
        // identifiers. Subscription events/snapshots remain authoritative.

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
      await this.audit.recordSafely({
        actorType: AuditActorType.SYSTEM,
        origin: AuditOrigin.WEBHOOK,
        action: AuditAction.BILLING_WEBHOOK_FAILED,
        result: AuditResult.FAILURE,
        targetType: 'PADDLE_WEBHOOK_EVENT',
        targetId: event.eventId,
        errorCode: auditErrorCode(error),
        metadata: { eventType: event.eventType },
      });
      if (error instanceof HttpException) throw error;

      throw new ServiceUnavailableException({
        code: 'PADDLE_WEBHOOK_PROCESSING_FAILED',
        message: 'Paddle olayı işlenemedi. Aynı olay yeniden gönderilebilir.',
        eventId: event.eventId,
      });
    }
  }

  private async recordTransactionReference(
    transaction: Prisma.TransactionClient,
    notification: TransactionNotification,
    occurredAt: Date,
    trustedWorkspaceId?: string,
  ) {
    const environment = paddleCheckoutEnvironment();
    const workspaceIds = new Set<string>();
    if (trustedWorkspaceId) workspaceIds.add(trustedWorkspaceId);

    const existing = await transaction.billingTransactionReference.findUnique({
      where: {
        environment_paddleTransactionId: {
          environment,
          paddleTransactionId: notification.id,
        },
      },
      select: {
        workspaceId: true,
        paddleSubscriptionId: true,
        paddleCustomerId: true,
      },
    });
    if (existing) workspaceIds.add(existing.workspaceId);

    if (notification.subscriptionId) {
      const subscription = await transaction.billingSubscription.findUnique({
        where: { paddleSubscriptionId: notification.subscriptionId },
        select: { workspaceId: true },
      });
      if (subscription) workspaceIds.add(subscription.workspaceId);
    }
    if (notification.customerId) {
      const subscription = await transaction.billingSubscription.findUnique({
        where: { paddleCustomerId: notification.customerId },
        select: { workspaceId: true },
      });
      if (subscription) workspaceIds.add(subscription.workspaceId);
    }

    const checkout = await transaction.billingCheckout.findFirst({
      where: { environment, paddleTransactionId: notification.id },
      select: { workspaceId: true },
    });
    if (checkout) workspaceIds.add(checkout.workspaceId);

    if (workspaceIds.size === 0) return false;
    if (workspaceIds.size !== 1) throw transactionReferenceConflict();

    if (
      (existing?.paddleSubscriptionId &&
        notification.subscriptionId &&
        existing.paddleSubscriptionId !== notification.subscriptionId) ||
      (existing?.paddleCustomerId &&
        notification.customerId &&
        existing.paddleCustomerId !== notification.customerId)
    ) {
      throw transactionReferenceConflict();
    }

    const workspaceId = [...workspaceIds][0];
    const reference = await transaction.billingTransactionReference.upsert({
      where: {
        environment_paddleTransactionId: {
          environment,
          paddleTransactionId: notification.id,
        },
      },
      create: {
        workspaceId,
        environment,
        paddleTransactionId: notification.id,
        paddleSubscriptionId: notification.subscriptionId,
        paddleCustomerId: notification.customerId,
        origin: notification.origin,
        occurredAt,
      },
      update: {
        paddleSubscriptionId: notification.subscriptionId ?? undefined,
        paddleCustomerId: notification.customerId ?? undefined,
        origin: notification.origin ?? undefined,
      },
      select: { workspaceId: true },
    });
    // The unique transaction key is environment-scoped. Never let a concurrent
    // event silently move an existing transaction to another customer account.
    if (reference.workspaceId !== workspaceId) {
      throw transactionReferenceConflict();
    }

    return true;
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
    const cancellationScheduled =
      !existing.cancelAtPeriodEnd &&
      data.scheduledChange?.action === 'cancel' &&
      Boolean(parseDate(data.scheduledChange.effectiveAt));
    const cancellationCompleted =
      existing.status !== BillingSubscriptionStatus.CANCELED &&
      status === BillingSubscriptionStatus.CANCELED;
    const subscriptionActivated =
      existing.paddleSubscriptionId !== data.id &&
      (status === BillingSubscriptionStatus.ACTIVE ||
        status === BillingSubscriptionStatus.TRIALING);
    const planChanged =
      existing.paddleSubscriptionId === data.id &&
      (existing.plan !== selection.plan || existing.cycle !== selection.cycle);

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
    await this.audit.record(
      {
        actorType: AuditActorType.SYSTEM,
        origin: reconciliation ? AuditOrigin.SCHEDULED : AuditOrigin.WEBHOOK,
        action: AuditAction.BILLING_SUBSCRIPTION_SYNCHRONIZED,
        result: AuditResult.SUCCESS,
        workspaceId: existing.workspaceId,
        targetType: 'BILLING_SUBSCRIPTION',
        targetId: existing.id,
        before: billingSubscriptionAuditSnapshot(existing),
        after: {
          plan: selection.plan,
          cycle: selection.cycle,
          status,
          paddleSubscriptionId: data.id,
          paddlePriceId: priceId,
          currentPeriodStart:
            parseDate(currentPeriod?.startsAt) ?? existing.currentPeriodStart,
          currentPeriodEnd:
            parseDate(currentPeriod?.endsAt) ?? existing.currentPeriodEnd,
          cancelAtPeriodEnd: data.scheduledChange?.action === 'cancel',
          scheduledAccessEndsAt:
            data.scheduledChange?.action === 'cancel' ||
            data.scheduledChange?.action === 'pause'
              ? parseDate(data.scheduledChange.effectiveAt)
              : null,
        },
        metadata: {
          snapshotAt,
          reconciled: Boolean(reconciliation),
        },
      },
      transaction,
    );
    const createdNotificationUserIds = new Set<string>();
    if (subscriptionActivated || planChanged) {
      const recipientUserIds =
        await this.notifications.createWorkspaceFinanceNotification(
          transaction,
          existing.workspaceId,
          {
            type: NotificationType.BILLING_SUBSCRIPTION_CHANGED,
            severity: NotificationSeverity.INFO,
            title: subscriptionActivated
              ? 'Aboneliğiniz etkinleştirildi'
              : 'Abonelik planınız değiştirildi',
            message: `${billingPlanLabel(selection.plan)} planı ${billingCycleLabel(selection.cycle)} ödeme dönemiyle etkinleştirildi.`,
            actionUrl: subscriptionActivated
              ? `/billing/${existing.workspaceId}/invoices`
              : `/billing/${existing.workspaceId}`,
            billingEmail: subscriptionActivated
              ? {
                  kind: 'SUBSCRIPTION_ACTIVATED',
                  plan: billingPlanLabel(selection.plan),
                  cycle: billingCycleLabel(selection.cycle),
                  nextBilledAt: parseDate(currentPeriod?.endsAt),
                }
              : {
                  kind: 'PLAN_CHANGED',
                  previousPlan: billingPlanLabel(existing.plan),
                  plan: billingPlanLabel(selection.plan),
                  cycle: billingCycleLabel(selection.cycle),
                  nextBilledAt: parseDate(currentPeriod?.endsAt),
                },
            entityType: 'BILLING_SUBSCRIPTION',
            entityId: existing.id,
            dedupeKey: subscriptionActivated
              ? `billing-subscription-activated:${data.id}`
              : `billing-subscription-changed:${data.id}:${snapshotAt.toISOString()}`,
          },
        );
      recipientUserIds.forEach((userId) =>
        createdNotificationUserIds.add(userId),
      );
    }
    if (cancellationScheduled) {
      const accessEndsAt = parseDate(data.scheduledChange?.effectiveAt);
      const recipientUserIds =
        await this.notifications.createWorkspaceFinanceNotification(
          transaction,
          existing.workspaceId,
          {
            type: NotificationType.BILLING_CANCELLATION,
            severity: NotificationSeverity.WARNING,
            title: 'Abonelik iptali planlandı',
            message: accessEndsAt
              ? `Aboneliğiniz ${formatBillingNotificationDate(accessEndsAt)} tarihinde sona erecek. Bu tarihe kadar plan haklarınızı kullanabilirsiniz.`
              : 'Aboneliğiniz mevcut faturalandırma döneminin sonunda sona erecek.',
            billingEmail: {
              kind: 'CANCELLATION_SCHEDULED',
              plan: billingPlanLabel(selection.plan),
              accessEndsAt,
            },
            actionUrl: `/billing/${existing.workspaceId}`,
            entityType: 'BILLING_SUBSCRIPTION',
            entityId: existing.id,
            dedupeKey: `billing-cancellation-scheduled:${data.id}:${accessEndsAt?.toISOString() ?? snapshotAt.toISOString()}`,
          },
        );
      recipientUserIds.forEach((userId) =>
        createdNotificationUserIds.add(userId),
      );
    }
    if (cancellationCompleted) {
      const recipientUserIds =
        await this.notifications.createWorkspaceFinanceNotification(
          transaction,
          existing.workspaceId,
          {
            type: NotificationType.BILLING_CANCELLATION,
            severity: NotificationSeverity.WARNING,
            title: 'Aboneliğiniz sona erdi',
            message:
              'Ücretli planınız sona erdi. Kayıtlı verilerinize erişebilir ve mevcut soruları manuel yanıtlayabilirsiniz.',
            actionUrl: `/billing/${existing.workspaceId}/plans`,
            billingEmail: {
              kind: 'SUBSCRIPTION_ENDED',
              plan: billingPlanLabel(selection.plan),
              endedAt: parseDate(data.canceledAt) ?? snapshotAt,
            },
            entityType: 'BILLING_SUBSCRIPTION',
            entityId: existing.id,
            dedupeKey: `billing-cancellation-completed:${data.id}`,
          },
        );
      recipientUserIds.forEach((userId) =>
        createdNotificationUserIds.add(userId),
      );
    }
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
          dedupeKey: `billing-payment:${data.id}:${currentPeriod?.startsAt ?? existing.currentPeriodStart.toISOString()}`,
          confirmedFailure: true,
          billingEmail: {
            kind: 'PAYMENT_FAILED',
            plan: billingPlanLabel(selection.plan),
            updatedAt: snapshotAt,
          },
        },
      );
      recipientUserIds.forEach((userId) =>
        createdNotificationUserIds.add(userId),
      );
      return {
        recipientUserIds: [...createdNotificationUserIds],
        reason: 'CREATED' as const,
      };
    }
    if (incomingHasBillingAccess) {
      const resolvedRecipientUserIds = existingHealthyNotificationChange
        ? existingHealthyNotificationChange.recipientUserIds
        : await this.notifications.resolveBillingIssues(
            transaction,
            existing.workspaceId,
          );
      const recipientUserIds = [
        ...new Set([
          ...createdNotificationUserIds,
          ...resolvedRecipientUserIds,
        ]),
      ];
      return {
        recipientUserIds,
        reason:
          createdNotificationUserIds.size > 0
            ? ('CREATED' as const)
            : ('READ_ALL' as const),
      };
    }
    if (createdNotificationUserIds.size > 0) {
      return {
        recipientUserIds: [...createdNotificationUserIds],
        reason: 'CREATED' as const,
      };
    }
  }

  private async syncAdjustment(
    transaction: Prisma.TransactionClient,
    data: AdjustmentNotification,
  ) {
    if (data.action !== 'refund' || data.status !== 'approved') return;

    const subscription = await transaction.billingSubscription.findFirst({
      where: {
        paddleCustomerId: data.customerId,
        ...(data.subscriptionId
          ? { paddleSubscriptionId: data.subscriptionId }
          : {}),
      },
      select: { id: true, workspaceId: true },
    });
    if (!subscription) return;

    const amount = formatBillingNotificationAmount(
      data.totals.total,
      data.currencyCode,
    );
    const recipientUserIds =
      await this.notifications.createWorkspaceFinanceNotification(
        transaction,
        subscription.workspaceId,
        {
          type: NotificationType.BILLING_REFUND,
          severity: NotificationSeverity.INFO,
          title: 'Ödeme iadeniz tamamlandı',
          message: `${amount} tutarındaki iade Paddle tarafından onaylandı. İşlemi faturalar bölümünden inceleyebilirsiniz.`,
          actionUrl: `/billing/${subscription.workspaceId}/invoices`,
          billingEmail: { kind: 'REFUND_APPROVED', amount },
          entityType: 'PADDLE_ADJUSTMENT',
          entityId: data.id,
          dedupeKey: `billing-refund:${data.id}`,
        },
      );
    return recipientUserIds.length
      ? { recipientUserIds, reason: 'CREATED' as const }
      : undefined;
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

// A timed-out write may still be applied by Paddle; its outcome is unknown.
async function boundedSubscriptionWrite<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Subscription write outcome unknown')),
          30_000,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
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
  const payments = [...transaction.payments].sort(
    (left, right) =>
      (Date.parse(right.capturedAt ?? right.createdAt) || 0) -
      (Date.parse(left.capturedAt ?? left.createdAt) || 0),
  );
  const payment =
    payments.find((item) => item.status === 'captured') ?? payments[0];
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

function formatBillingNotificationAmount(value: string, currency: string) {
  const amount = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(moneyFromMinorUnits(value, currency));
  return `${amount} ${currency === 'TRY' ? '₺' : currency}`;
}

function formatBillingNotificationDate(value: Date) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(value);
}

function billingPlanLabel(plan: BillingPlan) {
  const labels: Record<BillingPlan, string> = {
    [BillingPlan.STARTER]: 'Starter',
    [BillingPlan.GROWTH]: 'Growth',
    [BillingPlan.BUSINESS]: 'Business',
  };
  return labels[plan];
}

function billingCycleLabel(cycle: BillingCycle) {
  return cycle === BillingCycle.ANNUAL ? 'yıllık' : 'aylık';
}

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

function billingSubscriptionAuditSnapshot(subscription: {
  plan: BillingPlan;
  cycle: BillingCycle;
  status: BillingSubscriptionStatus;
  paddleSubscriptionId: string | null;
  paddlePriceId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  scheduledAccessEndsAt: Date | null;
}) {
  return {
    plan: subscription.plan,
    cycle: subscription.cycle,
    status: subscription.status,
    paddleSubscriptionId: subscription.paddleSubscriptionId,
    paddlePriceId: subscription.paddlePriceId,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    scheduledAccessEndsAt: subscription.scheduledAccessEndsAt,
  };
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function transactionReferenceConflict() {
  return new ConflictException({
    code: 'PADDLE_TRANSACTION_REFERENCE_MISMATCH',
    message:
      'Paddle iÅŸlem kimliÄŸi farklÄ± bir mÃ¼ÅŸteri hesabÄ±yla eÅŸleÅŸiyor.',
  });
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
