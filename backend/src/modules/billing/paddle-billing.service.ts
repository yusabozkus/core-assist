import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Environment,
  EventName,
  Paddle,
  type EventEntity,
  type SubscriptionNotification,
  type Transaction,
  type TransactionNotification,
} from '@paddle/paddle-node-sdk';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingCycle,
  BillingPlan,
  BillingSubscriptionStatus,
  StoreRole,
  WorkspaceRole,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BillingSubscriptionService } from './billing-subscription.service';
import {
  paddleEnvironment,
  paddlePlanForPrice,
  paddlePriceId,
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

@Injectable()
export class PaddleBillingService {
  private readonly logger = new Logger(PaddleBillingService.name);
  private client: Paddle | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: BillingSubscriptionService,
  ) {}

  async createCheckout(
    storeId: string,
    userId: string,
    plan: BillingPlan,
    cycle: BillingCycle,
  ) {
    const { workspaceId, subscription } =
      await this.getManageableSubscription(storeId, userId);
    if (
      subscription.paddleSubscriptionId &&
      subscription.status !== BillingSubscriptionStatus.CANCELED &&
      subscription.status !== BillingSubscriptionStatus.EXPIRED
    ) {
      throw new ConflictException({
        code: 'PADDLE_SUBSCRIPTION_ALREADY_EXISTS',
        message:
          'Bu çalışma alanının aktif bir aboneliği bulunuyor. Plan değişiklikleri abonelik yönetiminden yapılmalıdır.',
      });
    }

    const priceId = paddlePriceId(plan, cycle);

    try {
      const transaction = await this.getClient().transactions.create({
        items: [{ priceId, quantity: 1 }],
        customerId: subscription.paddleCustomerId ?? undefined,
        customData: {
          coreassist_workspace_id: workspaceId,
          coreassist_plan: plan,
          coreassist_cycle: cycle,
        },
      });

      return {
        transactionId: transaction.id,
        environment:
          paddleEnvironment() === Environment.production
            ? ('production' as const)
            : ('sandbox' as const),
      };
    } catch (error) {
      this.logger.error(
        'Paddle checkout transaction could not be created.',
        error instanceof Error ? error.message : undefined,
      );
      throw new BadGatewayException(
        'Ödeme adımı şu anda başlatılamadı. Lütfen tekrar deneyin.',
      );
    }
  }

  async getBillingHistory(storeId: string, userId: string) {
    const { subscription } = await this.getManageableSubscription(
      storeId,
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
        perPage: 100,
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
    storeId: string,
    userId: string,
    transactionId: string,
  ) {
    const { subscription } = await this.getManageableSubscription(
      storeId,
      userId,
    );

    if (!subscription.paddleCustomerId) {
      throw new NotFoundException('Fatura bulunamadı.');
    }

    try {
      const transaction = await this.getClient().transactions.get(
        transactionId,
      );
      if (transaction.customerId !== subscription.paddleCustomerId) {
        throw new NotFoundException('Fatura bulunamadı.');
      }

      const invoice = await this.getClient().transactions.getInvoicePDF(
        transactionId,
      );
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

  async createPortalSession(storeId: string, userId: string) {
    const { subscription } = await this.getManageableSubscription(
      storeId,
      userId,
    );

    if (
      !subscription.paddleCustomerId ||
      !subscription.paddleSubscriptionId
    ) {
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
        cancelSubscriptionUrl:
          subscriptionUrls?.cancelSubscription ?? null,
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

  async handleWebhook(rawBody: string, signature: string | undefined) {
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

    const occurredAt = parseDate(event.occurredAt) ?? new Date();

    try {
      const processed = await this.prisma.$transaction(async (transaction) => {
        await transaction.billingWebhookEvent.create({
          data: {
            id: event.eventId,
            eventType: event.eventType,
            occurredAt,
          },
        });

        if (SUBSCRIPTION_EVENTS.has(event.eventType)) {
          await this.syncSubscription(
            transaction,
            event.data as SubscriptionNotification,
            occurredAt,
          );
        } else if (event.eventType === EventName.TransactionCompleted) {
          await this.syncCompletedTransaction(
            transaction,
            event.data,
            occurredAt,
          );
        } else if (
          event.eventType === EventName.TransactionPaymentFailed ||
          event.eventType === EventName.TransactionPastDue
        ) {
          await this.syncFailedTransaction(transaction, event.data, occurredAt);
        }

        return true;
      });

      return { received: true, processed };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return { received: true, processed: false, duplicate: true };
      }
      throw error;
    }
  }

  private async syncSubscription(
    transaction: Prisma.TransactionClient,
    data: SubscriptionNotification,
    occurredAt: Date,
  ) {
    const workspaceId = customDataString(
      data.customData,
      'coreassist_workspace_id',
    );
    const existing = await this.findSubscription(
      transaction,
      workspaceId,
      data.id,
    );
    if (!existing) {
      this.logger.warn(
        `Paddle subscription ${data.id} could not be matched to a workspace.`,
      );
      return;
    }

    if (existing.paddleUpdatedAt && existing.paddleUpdatedAt > occurredAt) {
      return;
    }

    const priceId = firstSubscriptionPriceId(data);
    const selection =
      paddlePlanForPrice(priceId) ?? selectionFromCustomData(data.customData);
    const currentPeriod = data.currentBillingPeriod;
    const status = mapPaddleStatus(data.status);

    await transaction.billingSubscription.update({
      where: { id: existing.id },
      data: {
        ...(selection ? { plan: selection.plan, cycle: selection.cycle } : {}),
        status,
        paddleCustomerId: data.customerId,
        paddleSubscriptionId: data.id,
        paddlePriceId: priceId ?? existing.paddlePriceId,
        currentPeriodStart:
          parseDate(currentPeriod?.startsAt) ?? existing.currentPeriodStart,
        currentPeriodEnd:
          parseDate(currentPeriod?.endsAt) ?? existing.currentPeriodEnd,
        trialEndsAt:
          status === BillingSubscriptionStatus.TRIALING
            ? (parseDate(currentPeriod?.endsAt) ?? existing.trialEndsAt)
            : null,
        cancelAtPeriodEnd: data.scheduledChange?.action === 'cancel',
        canceledAt: parseDate(data.canceledAt),
        paddleUpdatedAt: occurredAt,
      },
    });
  }

  private async syncCompletedTransaction(
    transaction: Prisma.TransactionClient,
    data: TransactionNotification,
    occurredAt: Date,
  ) {
    const workspaceId = customDataString(
      data.customData,
      'coreassist_workspace_id',
    );
    const existing = await this.findSubscription(
      transaction,
      workspaceId,
      data.subscriptionId,
    );
    if (!existing) return;
    if (existing.paddleUpdatedAt && existing.paddleUpdatedAt > occurredAt) {
      return;
    }

    const priceId = firstTransactionPriceId(data);
    const selection =
      paddlePlanForPrice(priceId) ?? selectionFromCustomData(data.customData);

    await transaction.billingSubscription.update({
      where: { id: existing.id },
      data: {
        ...(selection ? { plan: selection.plan, cycle: selection.cycle } : {}),
        status: BillingSubscriptionStatus.ACTIVE,
        paddleCustomerId: data.customerId ?? existing.paddleCustomerId,
        paddleSubscriptionId:
          data.subscriptionId ?? existing.paddleSubscriptionId,
        paddlePriceId: priceId ?? existing.paddlePriceId,
        currentPeriodStart:
          parseDate(data.billingPeriod?.startsAt) ??
          existing.currentPeriodStart,
        currentPeriodEnd:
          parseDate(data.billingPeriod?.endsAt) ?? existing.currentPeriodEnd,
        trialEndsAt: null,
      },
    });
  }

  private async syncFailedTransaction(
    transaction: Prisma.TransactionClient,
    data: TransactionNotification,
    occurredAt: Date,
  ) {
    if (!data.subscriptionId) return;

    const existing = await transaction.billingSubscription.findUnique({
      where: { paddleSubscriptionId: data.subscriptionId },
    });
    if (
      !existing ||
      (existing.paddleUpdatedAt && existing.paddleUpdatedAt > occurredAt)
    ) {
      return;
    }

    await transaction.billingSubscription.update({
      where: { id: existing.id },
      data: {
        status: BillingSubscriptionStatus.PAST_DUE,
        paddleUpdatedAt: occurredAt,
      },
    });
  }

  private findSubscription(
    transaction: Prisma.TransactionClient,
    workspaceId: string | null,
    paddleSubscriptionId: string | null,
  ) {
    if (workspaceId) {
      return transaction.billingSubscription.findUnique({
        where: { workspaceId },
      });
    }
    if (paddleSubscriptionId) {
      return transaction.billingSubscription.findUnique({
        where: { paddleSubscriptionId },
      });
    }
    return null;
  }

  private getClient() {
    this.client ??= new Paddle(requirePaddleApiKey(), {
      environment: paddleEnvironment(),
    });
    return this.client;
  }

  private async getManageableSubscription(storeId: string, userId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        OR: [
          {
            members: {
              some: {
                userId,
                role: { in: [StoreRole.OWNER, StoreRole.ADMIN] },
              },
            },
          },
          {
            workspace: {
              members: {
                some: {
                  userId,
                  role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
                },
              },
            },
          },
        ],
      },
      select: { workspaceId: true },
    });

    if (!store) {
      throw new ForbiddenException(
        'Abonelik işlemi için mağaza yöneticisi olmalısınız.',
      );
    }

    return {
      workspaceId: store.workspaceId,
      subscription: await this.subscriptions.getOrCreateForWorkspace(
        store.workspaceId,
      ),
    };
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
  const selection =
    paddlePlanForPrice(
      transaction.items.find((item) => item.price?.id)?.price?.id,
    ) ?? selectionFromCustomData(transaction.customData);
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

function firstSubscriptionPriceId(data: SubscriptionNotification) {
  return data.items.find((item) => item.price?.id)?.price?.id ?? null;
}

function firstTransactionPriceId(data: TransactionNotification) {
  return data.items.find((item) => item.price?.id)?.price?.id ?? null;
}

function selectionFromCustomData(
  customData: Record<string, unknown> | null,
): { plan: BillingPlan; cycle: BillingCycle } | null {
  const plan = customDataString(customData, 'coreassist_plan');
  const cycle = customDataString(customData, 'coreassist_cycle');
  if (
    !Object.values(BillingPlan).includes(plan as BillingPlan) ||
    !Object.values(BillingCycle).includes(cycle as BillingCycle)
  ) {
    return null;
  }
  return { plan: plan as BillingPlan, cycle: cycle as BillingCycle };
}

function customDataString(
  customData: Record<string, unknown> | null,
  key: string,
) {
  const value = customData?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
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

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}
