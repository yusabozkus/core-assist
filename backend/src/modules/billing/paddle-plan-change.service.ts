import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiError, Paddle, type Subscription } from '@paddle/paddle-node-sdk';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { BillingCycle, BillingPlan } from '../../generated/prisma/enums';
import { BillingAuthorizationService } from './billing-authorization.service';
import { BillingUsageService } from './billing-usage.service';
import { PLAN_ENTITLEMENTS } from './billing-plan.config';
import {
  paddleCheckoutEnvironment,
  paddleEnvironment,
  paddlePlanForPrice,
  paddlePriceId,
  requirePaddleApiKey,
} from './paddle-billing.config';
import {
  PENDING_PLAN_CHANGE_STATUSES,
  planChangeAmounts,
  planChangeConflict,
  resolvePlanChangePolicy,
  subscriptionFingerprint,
} from './billing-plan-change.policy';
import {
  assertPaidRecurringPrice,
  requirePaidRecurringPrice,
} from './paddle-price.policy';

type Change = Prisma.BillingPlanChangeGetPayload<object>;
type LocalSubscription = Prisma.BillingSubscriptionGetPayload<object>;
const PREVIEW_TTL_MS = 5 * 60_000;
const DEFAULT_RATE_LIMIT_RETRY_SECONDS = 60;
const MAX_RATE_LIMIT_RETRY_SECONDS = 24 * 60 * 60;
const MAX_RATE_LIMIT_RETRIES = 5;

@Injectable()
export class PaddlePlanChangeService {
  private readonly logger = new Logger(PaddlePlanChangeService.name);
  private client: Paddle | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: BillingAuthorizationService,
    private readonly usage: BillingUsageService,
  ) {}

  async preview(
    workspaceId: string,
    userId: string,
    plan: BillingPlan,
    cycle: BillingCycle,
  ) {
    await this.authorization.requireWorkspaceAccess(workspaceId, userId);
    const targetPriceId = paddlePriceId(plan, cycle);
    const configured = paddlePlanForPrice(targetPriceId);
    if (configured?.plan !== plan || configured.cycle !== cycle) {
      throw planChangeConflict(
        'BILLING_PRICE_CONFIGURATION_INVALID',
        'Plan fiyatı yapılandırması doğrulanamadı. Destek ile iletişime geçin.',
      );
    }
    await requirePaidRecurringPrice(this.getClient(), targetPriceId, cycle);
    const local = await this.prisma.billingSubscription.findUnique({
      where: { workspaceId },
    });
    assertChangeable(local);
    await this.assertNoPending(this.prisma, workspaceId);
    const remote = await this.loadRemote(local);
    if (remote.items[0].price.id === targetPriceId) {
      throw planChangeConflict(
        'BILLING_PLAN_UNCHANGED',
        'Bu plan ve ödeme dönemi zaten kullanılıyor.',
      );
    }
    const policy = resolvePlanChangePolicy(
      local.plan,
      local.cycle,
      plan,
      cycle,
    );
    let amounts: ReturnType<typeof planChangeAmounts>;
    try {
      amounts = await this.calculatePreview(
        local,
        targetPriceId,
        cycle,
        policy.prorationBillingMode,
      );
    } catch (error) {
      this.logFailure('preview', undefined, error);
      throw new BadGatewayException(
        'Plan değişikliği tutarı Paddle’dan alınamadı. Lütfen tekrar deneyin.',
      );
    }
    const questionUsage = await this.usage.getCurrentForWorkspace(workspaceId);
    return this.withWorkspaceLock(workspaceId, async (tx) => {
      const current = await tx.billingSubscription.findUnique({
        where: { workspaceId },
      });
      assertChangeable(current);
      assertSameSubscription(current, local);
      await this.assertNoPending(tx, workspaceId);
      const capacity = await this.capacity(tx, workspaceId, plan);
      const change = await tx.billingPlanChange.create({
        data: {
          workspaceId,
          requestedByUserId: userId,
          environment: paddleCheckoutEnvironment(),
          paddleSubscriptionId: remote.id,
          paddleCustomerId: remote.customerId,
          sourcePriceId: remote.items[0].price.id,
          sourceUpdatedAt: new Date(remote.updatedAt),
          sourceFingerprint: subscriptionFingerprint(remote),
          targetPriceId,
          plan,
          cycle,
          preview: amounts,
          expiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
        },
      });
      return {
        id: change.id,
        plan,
        cycle,
        currentPlan: current.plan,
        currentCycle: current.cycle,
        changeType: policy.changeType,
        settlementTiming: policy.settlementTiming,
        effectiveFrom: 'immediately' as const,
        expiresAt: change.expiresAt,
        amounts,
        capacity,
        canConfirm: capacity.every((item) => item.used <= item.limit),
        questions: {
          used: questionUsage.used,
          limit: PLAN_ENTITLEMENTS[plan].monthlyAiQuestions,
          resetsAt: questionUsage.periodEnd,
        },
      };
    });
  }

  async confirm(workspaceId: string, userId: string, changeId: string) {
    await this.authorization.requireWorkspaceAccess(workspaceId, userId);
    const existingChange = await this.findChange(
      this.prisma,
      workspaceId,
      changeId,
    );
    if (
      existingChange.status !== 'PREVIEWED' &&
      existingChange.status !== 'RETRY_SCHEDULED'
    ) {
      if (existingChange.requestedByUserId !== userId)
        throw planChangeConflict(
          'BILLING_PREVIEW_OWNER_MISMATCH',
          'Kendi hesabınızdan yeni bir önizleme alın.',
        );
      return changeResult(existingChange);
    }
    if (
      existingChange.status === 'RETRY_SCHEDULED' &&
      (!existingChange.retryAt || existingChange.retryAt.getTime() > Date.now())
    ) {
      return changeResult(existingChange);
    }
    // The reservation survives a process crash, page reload and duplicate POST.
    // No outbound mutation is made while holding a database transaction open.
    const reserved = await this.withWorkspaceLock(workspaceId, async (tx) => {
      const change = await this.findChange(tx, workspaceId, changeId);
      if (change.requestedByUserId !== userId) {
        throw planChangeConflict(
          'BILLING_PREVIEW_OWNER_MISMATCH',
          'Kendi hesabınızdan yeni bir önizleme alın.',
        );
      }
      const isScheduledRetry = change.status === 'RETRY_SCHEDULED';
      if (change.status !== 'PREVIEWED' && !isScheduledRetry)
        return { change, claimed: false };
      if (
        isScheduledRetry &&
        (!change.retryAt || change.retryAt.getTime() > Date.now())
      )
        return { change, claimed: false };
      if (!isScheduledRetry && change.expiresAt.getTime() <= Date.now())
        throw stalePreview();
      assertEnvironmentAndPrice(change);
      await this.assertNoPending(tx, workspaceId, change.id);
      const subscription = await tx.billingSubscription.findUnique({
        where: { workspaceId },
      });
      assertChangeable(subscription);
      assertQuoteSubscription(change, subscription);
      assertCapacity(await this.capacity(tx, workspaceId, change.plan));
      return {
        claimed: true,
        change: await tx.billingPlanChange.update({
          where: { id: change.id },
          data: {
            status: 'PROCESSING',
            submittedAt: change.submittedAt ?? new Date(),
            retryAfterSeconds: null,
            retryAt: null,
          },
        }),
      };
    });
    if (!reserved.claimed) return changeResult(reserved.change);
    const change = reserved.change;

    // Recheck the server-owned quote immediately before submission. Prices,
    // tax/address, discounts, cancellation and usage may have changed meanwhile.
    try {
      const subscription = await this.prisma.billingSubscription.findUnique({
        where: { workspaceId },
      });
      assertChangeable(subscription);
      assertQuoteSubscription(change, subscription);
      await requirePaidRecurringPrice(
        this.getClient(),
        change.targetPriceId,
        change.cycle,
      );
      const remote = await this.loadRemote(subscription);
      if (subscriptionFingerprint(remote) !== change.sourceFingerprint)
        throw stalePreview();
      const fresh = await this.calculatePreview(
        subscription,
        change.targetPriceId,
        change.cycle,
        resolvePlanChangePolicy(
          subscription.plan,
          subscription.cycle,
          change.plan,
          change.cycle,
        ).prorationBillingMode,
      );
      const expected = change.preview as Record<string, unknown>;
      if (Object.entries(fresh).some(([key, value]) => expected[key] !== value))
        throw stalePreview();
      await this.authorization.requireWorkspaceAccess(workspaceId, userId);
      await this.withWorkspaceLock(workspaceId, async (tx) => {
        const current = await tx.billingSubscription.findUnique({
          where: { workspaceId },
        });
        assertChangeable(current);
        assertQuoteSubscription(change, current);
        if (change.retryCount === 0 && change.expiresAt.getTime() <= Date.now())
          throw stalePreview();
        assertCapacity(await this.capacity(tx, workspaceId, change.plan));
      });
    } catch (error) {
      await this.prisma.billingPlanChange.updateMany({
        where: { id: change.id, status: 'PROCESSING' },
        data: { status: 'FAILED', failureCode: 'PRECHECK_FAILED' },
      });
      if (error instanceof Error && 'getStatus' in error) throw error;
      throw new BadGatewayException(
        'Abonelik yeniden doğrulanamadı. Değişiklik uygulanmadı; yeni bir önizleme alın.',
      );
    }

    try {
      const remote = await this.getClient().subscriptions.update(
        change.paddleSubscriptionId,
        updateRequest(
          change.targetPriceId,
          policyForChange(change).prorationBillingMode,
        ),
      );
      if (
        remote.id !== change.paddleSubscriptionId ||
        remote.customerId !== change.paddleCustomerId ||
        remote.items.length !== 1 ||
        remote.items[0]?.quantity !== 1 ||
        remote.items[0].price.id !== change.targetPriceId ||
        remote.status !== 'active'
      ) {
        throw new Error('Unexpected subscription update response');
      }
      assertPaidRecurringPrice(
        remote.items[0].price,
        change.targetPriceId,
        change.cycle,
      );
      const reconcileAfter = new Date();
      await this.prisma.$transaction([
        this.prisma.billingPlanChange.updateMany({
          where: { id: change.id, status: 'PROCESSING' },
          data: { status: 'AWAITING_WEBHOOK' },
        }),
        this.prisma.billingSubscription.updateMany({
          where: {
            workspaceId,
            paddleSubscriptionId: change.paddleSubscriptionId,
            paddleCustomerId: change.paddleCustomerId,
          },
          data: { reconcileAfter },
        }),
      ]);
    } catch (error) {
      if (isPaddleRateLimit(error)) {
        const retryCount = change.retryCount + 1;
        const retryAfterSeconds = rateLimitRetrySeconds(error);
        const retriesExhausted = retryCount > MAX_RATE_LIMIT_RETRIES;
        await this.prisma.billingPlanChange.updateMany({
          where: { id: change.id, status: 'PROCESSING' },
          data: retriesExhausted
            ? {
                status: 'FAILED',
                failureCode: 'PADDLE_RATE_LIMIT_RETRIES_EXHAUSTED',
                retryAfterSeconds: null,
                retryAt: null,
                retryCount,
              }
            : {
                status: 'RETRY_SCHEDULED',
                failureCode: 'PADDLE_RATE_LIMITED',
                retryAfterSeconds,
                retryAt: new Date(Date.now() + retryAfterSeconds * 1000),
                retryCount,
              },
        });
        this.logFailure('rate-limit', change.id, error);
        return changeResult(
          await this.findChange(this.prisma, workspaceId, change.id),
        );
      }
      // Never repeat an ambiguous PATCH: it may have charged the customer.
      // A subsequent verified webhook can complete this same operation.
      const rejected =
        error instanceof ApiError &&
        error.type === 'request_error' &&
        error.code !== 'conflict' &&
        error.code !== 'too_many_requests';
      const resultUpdate = this.prisma.billingPlanChange.updateMany({
        where: { id: change.id, status: 'PROCESSING' },
        data: {
          status: rejected ? 'FAILED' : 'REVIEW_REQUIRED',
          failureCode: rejected ? 'PADDLE_REJECTED' : 'PADDLE_RESULT_UNKNOWN',
        },
      });
      if (rejected) {
        await resultUpdate;
      } else {
        await this.prisma.$transaction([
          resultUpdate,
          this.prisma.billingSubscription.updateMany({
            where: {
              workspaceId,
              paddleSubscriptionId: change.paddleSubscriptionId,
              paddleCustomerId: change.paddleCustomerId,
            },
            data: { reconcileAfter: new Date() },
          }),
        ]);
      }
      this.logFailure('apply', change.id, error);
    }
    // Only the signed subscription webhook updates local plan/entitlements.
    return changeResult(
      await this.findChange(this.prisma, workspaceId, change.id),
    );
  }

  async getStatus(workspaceId: string, userId: string, changeId: string) {
    await this.authorization.requireWorkspaceAccess(workspaceId, userId);
    return changeResult(
      await this.findChange(this.prisma, workspaceId, changeId),
    );
  }

  async retryScheduled(changeId: string) {
    const change = await this.prisma.billingPlanChange.findUnique({
      where: { id: changeId },
      select: {
        id: true,
        workspaceId: true,
        requestedByUserId: true,
        status: true,
        retryAt: true,
      },
    });
    if (
      !change ||
      change.status !== 'RETRY_SCHEDULED' ||
      !change.retryAt ||
      change.retryAt.getTime() > Date.now()
    )
      return false;
    if (!change.requestedByUserId) {
      await this.failScheduledRetry(change.id, 'PLAN_CHANGE_OWNER_MISSING');
      return false;
    }
    try {
      await this.confirm(
        change.workspaceId,
        change.requestedByUserId,
        change.id,
      );
      return true;
    } catch (error) {
      await this.failScheduledRetry(change.id, 'PLAN_CHANGE_RETRY_REJECTED');
      this.logFailure('scheduled-retry', change.id, error);
      return false;
    }
  }

  private async findChange(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    id: string,
  ) {
    const change = await tx.billingPlanChange.findFirst({
      where: { id, workspaceId },
    });
    if (!change) throw new NotFoundException('Plan değişikliği bulunamadı.');
    return change;
  }

  private async loadRemote(local: LocalSubscription) {
    let remote: Subscription;
    try {
      remote = await this.getClient().subscriptions.get(
        local.paddleSubscriptionId!,
      );
    } catch {
      throw new BadGatewayException(
        'Mevcut abonelik Paddle’dan doğrulanamadı. Lütfen tekrar deneyin.',
      );
    }
    const item = remote.items[0];
    const selection = paddlePlanForPrice(item?.price.id);
    if (
      remote.id !== local.paddleSubscriptionId ||
      remote.customerId !== local.paddleCustomerId ||
      remote.items.length !== 1 ||
      item?.quantity !== 1 ||
      item.price.id !== local.paddlePriceId ||
      selection?.plan !== local.plan ||
      selection.cycle !== local.cycle ||
      item.price.billingCycle?.frequency !== 1 ||
      item.price.billingCycle.interval !==
        (local.cycle === 'MONTHLY' ? 'month' : 'year')
    ) {
      throw planChangeConflict(
        'BILLING_SUBSCRIPTION_OUT_OF_SYNC',
        'Abonelik bilgileri henüz eşleşmiyor. Webhook güncellemesini bekleyip tekrar deneyin.',
      );
    }
    if (
      remote.status !== 'active' ||
      remote.collectionMode !== 'automatic' ||
      remote.scheduledChange
    ) {
      throw planChangeConflict(
        'BILLING_SUBSCRIPTION_NOT_CHANGEABLE',
        'Önce bekleyen ödeme veya planlanmış iptal/duraklatma işlemini abonelik yönetiminden çözün.',
      );
    }
    if (
      !remote.nextBilledAt ||
      !Number.isFinite(Date.parse(remote.updatedAt)) ||
      !Number.isFinite(Date.parse(remote.nextBilledAt)) ||
      Date.parse(remote.nextBilledAt) - Date.now() <= 30 * 60_000
    ) {
      throw planChangeConflict(
        'BILLING_RENEWAL_TOO_CLOSE',
        'Yenilemeye 30 dakikadan az kaldığında plan değiştirilemez. Yenilemeden sonra tekrar deneyin.',
      );
    }
    return remote;
  }

  private async calculatePreview(
    local: LocalSubscription,
    priceId: string,
    cycle: BillingCycle,
    prorationBillingMode:
      'prorated_immediately' | 'prorated_next_billing_period',
  ) {
    const preview = await this.getClient().subscriptions.previewUpdate(
      local.paddleSubscriptionId!,
      updateRequest(priceId, prorationBillingMode),
    );
    const item = preview.items[0];
    if (
      preview.customerId !== local.paddleCustomerId ||
      preview.items.length !== 1 ||
      item?.quantity !== 1 ||
      item.price.id !== priceId ||
      item.price.billingCycle?.frequency !== 1 ||
      item.price.billingCycle.interval !==
        (cycle === 'MONTHLY' ? 'month' : 'year')
    ) {
      throw planChangeConflict(
        'BILLING_PREVIEW_UNAVAILABLE',
        'Önizlemedeki müşteri, fiyat veya ödeme dönemi eşleşmiyor. İşlem başlatılmadı.',
      );
    }
    return planChangeAmounts(preview);
  }

  private async capacity(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    plan: BillingPlan,
  ) {
    const limits = PLAN_ENTITLEMENTS[plan];
    const [stores, members, products] = await Promise.all([
      tx.store.count({ where: { workspaceId, status: 'ACTIVE' } }),
      tx.workspaceMember.count({ where: { workspaceId } }),
      tx.product.count({ where: { store: { workspaceId }, status: 'ACTIVE' } }),
    ]);
    return [
      {
        key: 'stores',
        label: 'Aktif mağaza',
        used: stores,
        limit: limits.stores,
      },
      {
        key: 'members',
        label: 'Kullanıcı',
        used: members,
        limit: limits.members,
      },
      {
        key: 'activeProducts',
        label: 'Aktif ürün',
        used: products,
        limit: limits.activeProducts,
      },
    ];
  }

  private async assertNoPending(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    excludedChangeId?: string,
  ) {
    const [pendingChange, pendingCheckout] = await Promise.all([
      tx.billingPlanChange.findFirst({
        where: {
          workspaceId,
          status: { in: PENDING_PLAN_CHANGE_STATUSES },
          ...(excludedChangeId ? { id: { not: excludedChangeId } } : {}),
        },
        select: { id: true },
      }),
      tx.billingCheckout.findFirst({
        where: {
          workspaceId,
          status: { in: ['CREATING', 'OPEN', 'REVIEW_REQUIRED'] },
        },
        select: { id: true },
      }),
    ]);
    if (pendingChange || pendingCheckout) {
      throw planChangeConflict(
        'BILLING_PLAN_CHANGE_PENDING',
        'Bekleyen bir ödeme veya plan değişikliği var. Durumu yenileyin; işlem sonuçlanmadan yeni bir değişiklik başlatılamaz.',
      );
    }
  }

  private async failScheduledRetry(id: string, failureCode: string) {
    await this.prisma.billingPlanChange.updateMany({
      where: { id, status: 'RETRY_SCHEDULED' },
      data: {
        status: 'FAILED',
        failureCode,
        retryAfterSeconds: null,
        retryAt: null,
      },
    });
  }

  private withWorkspaceLock<T>(
    workspaceId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "billing_subscription" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
      return work(tx);
    });
  }

  private getClient() {
    this.client ??= new Paddle(requirePaddleApiKey(), {
      environment: paddleEnvironment(),
    });
    return this.client;
  }

  private logFailure(
    stage: string,
    changeId: string | undefined,
    error: unknown,
  ) {
    this.logger.warn({
      message: 'Paddle plan change requires attention.',
      stage,
      changeId,
      code: error instanceof ApiError ? error.code : 'VERIFICATION_FAILED',
    });
  }
}

function updateRequest(
  priceId: string,
  prorationBillingMode: 'prorated_immediately' | 'prorated_next_billing_period',
) {
  return {
    items: [{ priceId, quantity: 1 }],
    prorationBillingMode,
    onPaymentFailure: 'prevent_change' as const,
  };
}

function assertChangeable(
  subscription: LocalSubscription | null,
): asserts subscription is LocalSubscription {
  if (
    !subscription?.paddleSubscriptionId ||
    !subscription.paddleCustomerId ||
    !subscription.paddlePriceId ||
    subscription.status !== 'ACTIVE' ||
    subscription.cancelAtPeriodEnd
  ) {
    throw planChangeConflict(
      'BILLING_SUBSCRIPTION_NOT_CHANGEABLE',
      'Plan değiştirmek için aktif bir Paddle aboneliği gerekir. Bekleyen ödeme veya iptal varsa önce abonelik yönetiminden çözün.',
    );
  }
}

function assertSameSubscription(
  current: LocalSubscription,
  expected: LocalSubscription,
) {
  if (
    current.paddleSubscriptionId !== expected.paddleSubscriptionId ||
    current.paddleCustomerId !== expected.paddleCustomerId ||
    current.paddlePriceId !== expected.paddlePriceId ||
    current.currentPeriodEnd.getTime() !== expected.currentPeriodEnd.getTime()
  )
    throw stalePreview();
}

function assertQuoteSubscription(
  change: Change,
  subscription: LocalSubscription,
) {
  if (
    change.paddleSubscriptionId !== subscription.paddleSubscriptionId ||
    change.paddleCustomerId !== subscription.paddleCustomerId ||
    change.sourcePriceId !== subscription.paddlePriceId
  )
    throw stalePreview();
}

function assertEnvironmentAndPrice(change: Change) {
  const source = paddlePlanForPrice(change.sourcePriceId);
  if (
    change.environment !== paddleCheckoutEnvironment() ||
    !source ||
    change.targetPriceId !== paddlePriceId(change.plan, change.cycle)
  )
    throw stalePreview();
}

function policyForChange(change: Change) {
  const source = paddlePlanForPrice(change.sourcePriceId);
  if (!source) throw stalePreview();
  return resolvePlanChangePolicy(
    source.plan,
    source.cycle,
    change.plan,
    change.cycle,
  );
}

function assertCapacity(
  capacity: Array<{ label: string; used: number; limit: number }>,
) {
  const exceeded = capacity.filter((item) => item.used > item.limit);
  if (exceeded.length)
    throw planChangeConflict(
      'BILLING_DOWNGRADE_LIMIT_EXCEEDED',
      `Yeni planın limitleri aşılıyor: ${exceeded.map((item) => `${item.label} ${item.used}/${item.limit}`).join(', ')}. Önce kullanımı azaltın; hiçbir veri otomatik silinmez.`,
    );
}

function stalePreview() {
  return planChangeConflict(
    'BILLING_PREVIEW_EXPIRED',
    'Tutar veya abonelik bilgisi değişti ya da önizlemenin süresi doldu. Güncel tutarı görmek için önizlemeyi yenileyin.',
  );
}

function changeResult(change: Change) {
  return {
    id: change.id,
    status: change.status,
    plan: change.plan,
    cycle: change.cycle,
    failureCode: change.failureCode,
    retryAfterSeconds: change.retryAfterSeconds,
    retryAt: change.retryAt,
    retryCount: change.retryCount,
    completedAt: change.completedAt,
  };
}

function isPaddleRateLimit(error: unknown): error is ApiError {
  return error instanceof ApiError && error.code === 'too_many_requests';
}

function rateLimitRetrySeconds(error: ApiError) {
  const retryAfter = error.retryAfter;
  if (!retryAfter || !Number.isFinite(retryAfter) || retryAfter <= 0)
    return DEFAULT_RATE_LIMIT_RETRY_SECONDS;
  return Math.min(Math.ceil(retryAfter), MAX_RATE_LIMIT_RETRY_SECONDS);
}
