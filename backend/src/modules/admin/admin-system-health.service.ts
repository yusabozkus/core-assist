import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  AuditResult,
  BillingSubscriptionStatus,
  CatalogSyncStatus,
  ChannelConnectionStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_RECOVERY_QUEUE } from '../billing/billing-reconciliation.processor';
import { PADDLE_WEBHOOK_QUEUE } from '../billing/paddle-webhook.constants';
import { PRODUCT_SYNC_QUEUE } from '../product-sync/product-sync.constants';
import { QUESTION_ANSWER_QUEUE } from '../question-answer/question-answer.constants';
import { QUESTION_SYNC_QUEUE } from '../question-sync/question-sync.constants';
import { QUESTION_DRAFT_QUEUE } from '../questions/question-draft.constants';
import { SIZE_GUIDE_QUEUE } from '../size-guides/size-guide.constants';

const DAY = 24 * 60 * 60 * 1000;
const RECONCILIATION_GRACE_MS = 15 * 60 * 1000;
const HEALTH_CACHE_MS = 15 * 1000;
const HEADER_HEALTH_TIMEOUT_MS = 2_500;

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';

@Injectable()
export class AdminSystemHealthService {
  private cachedHealth: {
    expiresAt: number;
    value: Awaited<
      ReturnType<AdminSystemHealthService['collectHealthSnapshot']>
    >;
  } | null = null;
  private healthRequest: ReturnType<
    AdminSystemHealthService['collectHealthSnapshot']
  > | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(PRODUCT_SYNC_QUEUE)
    private readonly productSyncQueue: Queue,
    @InjectQueue(QUESTION_SYNC_QUEUE)
    private readonly questionSyncQueue: Queue,
    @InjectQueue(QUESTION_DRAFT_QUEUE)
    private readonly questionDraftQueue: Queue,
    @InjectQueue(QUESTION_ANSWER_QUEUE)
    private readonly questionAnswerQueue: Queue,
    @InjectQueue(SIZE_GUIDE_QUEUE)
    private readonly sizeGuideQueue: Queue,
    @InjectQueue(PADDLE_WEBHOOK_QUEUE)
    private readonly paddleWebhookQueue: Queue,
    @InjectQueue(BILLING_RECOVERY_QUEUE)
    private readonly billingRecoveryQueue: Queue,
  ) {}

  async getHealth() {
    if (this.cachedHealth && this.cachedHealth.expiresAt > Date.now()) {
      return this.cachedHealth.value;
    }
    if (this.healthRequest) return this.healthRequest;

    const request = this.collectHealthSnapshot();
    this.healthRequest = request;

    try {
      const value = await request;
      this.cachedHealth = {
        expiresAt: Date.now() + HEALTH_CACHE_MS,
        value,
      };
      return value;
    } finally {
      if (this.healthRequest === request) this.healthRequest = null;
    }
  }

  async getHeaderHealth() {
    let timeoutId: NodeJS.Timeout | undefined;

    try {
      const health = await Promise.race([
        this.getHealth(),
        new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => resolve(null), HEADER_HEALTH_TIMEOUT_MS);
          timeoutId.unref();
        }),
      ]);

      if (!health) return { status: 'DOWN' as const, issueCount: 1 };

      const unavailableServices = Object.values(health.services).filter(
        (service) => service.status === 'DOWN',
      ).length;

      return {
        status: health.status,
        issueCount:
          unavailableServices +
          health.summary.unavailableQueues +
          health.summary.pausedQueues +
          health.summary.billingIssues +
          health.summary.connectionIssues,
      };
    } catch {
      return { status: 'DOWN' as const, issueCount: 1 };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private async collectHealthSnapshot() {
    const now = new Date();
    const [database, redis, queues] = await Promise.all([
      this.getDatabaseSnapshot(now),
      this.getRedisHealth(),
      this.getQueueHealth(),
    ]);
    const queueBacklog = queues.reduce(
      (total, queue) =>
        total +
        queue.counts.waiting +
        queue.counts.active +
        queue.counts.delayed,
      0,
    );
    const unavailableQueues = queues.filter((queue) => !queue.available).length;
    const pausedQueues = queues.filter((queue) => queue.paused).length;
    const status = overallStatus({
      database: database.status,
      redis: redis.status,
      unavailableQueues,
      pausedQueues,
      billingIssues:
        database.billing.webhookFailuresLast24Hours +
        database.billing.overdueReconciliations,
      connectionIssues: database.marketplaces.issueCount,
    });

    return {
      status,
      services: {
        api: { status: 'HEALTHY' as const },
        database: {
          status: database.status,
          latencyMs: database.latencyMs,
          errorCode: database.errorCode,
        },
        redis,
      },
      queues,
      summary: {
        queueBacklog,
        unavailableQueues,
        pausedQueues,
        retainedQueueFailures: queues.reduce(
          (total, queue) => total + queue.counts.failed,
          0,
        ),
        connectionIssues: database.marketplaces.issueCount,
        billingIssues:
          database.billing.webhookFailuresLast24Hours +
          database.billing.overdueReconciliations,
      },
      billing: database.billing,
      marketplaces: database.marketplaces,
      syncs: database.syncs,
      recentErrors: database.recentErrors,
      generatedAt: now,
    };
  }

  private async getDatabaseSnapshot(now: Date) {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latencyMs = Date.now() - startedAt;
      const dayAgo = new Date(now.getTime() - DAY);
      const overdueReconcileBefore = new Date(
        now.getTime() - RECONCILIATION_GRACE_MS,
      );
      const [
        lastWebhook,
        webhookEventsLastDay,
        webhookFailuresLastDay,
        overdueReconciliations,
        reconciliationFailures,
        connectionGroups,
        connectionIssueCount,
        connectionIssues,
        syncGroups,
        recentErrors,
      ] = await Promise.all([
        this.prisma.billingWebhookEvent.findFirst({
          orderBy: { processedAt: 'desc' },
          select: { eventType: true, occurredAt: true, processedAt: true },
        }),
        this.prisma.billingWebhookEvent.count({
          where: { processedAt: { gte: dayAgo } },
        }),
        this.prisma.auditLog.count({
          where: {
            action: 'BILLING_WEBHOOK_FAILED',
            result: AuditResult.FAILURE,
            createdAt: { gte: dayAgo },
          },
        }),
        this.prisma.billingSubscription.count({
          where: {
            status: {
              in: [
                BillingSubscriptionStatus.TRIALING,
                BillingSubscriptionStatus.ACTIVE,
                BillingSubscriptionStatus.PAST_DUE,
                BillingSubscriptionStatus.PAUSED,
              ],
            },
            reconcileAfter: { lt: overdueReconcileBefore },
          },
        }),
        this.prisma.billingSubscription.count({
          where: { reconcileFailures: { gt: 0 } },
        }),
        this.prisma.channelConnection.groupBy({
          by: ['providerKey', 'status'],
          where: { removedAt: null },
          _count: { _all: true },
        }),
        this.prisma.channelConnection.count({
          where: {
            removedAt: null,
            OR: [
              {
                status: {
                  in: [
                    ChannelConnectionStatus.ERROR,
                    ChannelConnectionStatus.DISCONNECTED,
                  ],
                },
              },
              { failureReason: { not: null } },
              { questionSyncFailureReason: { not: null } },
            ],
          },
        }),
        this.prisma.channelConnection.findMany({
          where: {
            removedAt: null,
            OR: [
              {
                status: {
                  in: [
                    ChannelConnectionStatus.ERROR,
                    ChannelConnectionStatus.DISCONNECTED,
                  ],
                },
              },
              { failureReason: { not: null } },
              { questionSyncFailureReason: { not: null } },
            ],
          },
          select: {
            id: true,
            providerKey: true,
            status: true,
            failureReason: true,
            questionSyncFailureReason: true,
            updatedAt: true,
            store: {
              select: {
                id: true,
                name: true,
                workspace: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 8,
        }),
        this.prisma.catalogSyncRun.groupBy({
          by: ['status'],
          where: { startedAt: { gte: dayAgo } },
          _count: { _all: true },
        }),
        this.prisma.auditLog.findMany({
          where: { result: AuditResult.FAILURE, createdAt: { gte: dayAgo } },
          select: {
            id: true,
            action: true,
            origin: true,
            workspaceId: true,
            storeId: true,
            targetType: true,
            targetId: true,
            errorCode: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

      const providers = new Map<
        string,
        { total: number; connected: number; pending: number; issues: number }
      >();
      for (const group of connectionGroups) {
        const provider = providers.get(group.providerKey) ?? {
          total: 0,
          connected: 0,
          pending: 0,
          issues: 0,
        };
        provider.total += group._count._all;
        if (group.status === ChannelConnectionStatus.CONNECTED) {
          provider.connected += group._count._all;
        } else if (group.status === ChannelConnectionStatus.PENDING) {
          provider.pending += group._count._all;
        } else {
          provider.issues += group._count._all;
        }
        providers.set(group.providerKey, provider);
      }

      return {
        status: 'HEALTHY' as HealthStatus,
        latencyMs,
        errorCode: null as string | null,
        billing: {
          lastWebhook,
          webhookEventsLast24Hours: webhookEventsLastDay,
          webhookFailuresLast24Hours: webhookFailuresLastDay,
          overdueReconciliations,
          reconciliationFailures,
        },
        marketplaces: {
          issueCount: connectionIssueCount,
          providers: [...providers.entries()].map(([providerKey, counts]) => ({
            providerKey,
            ...counts,
          })),
          issues: connectionIssues.map((connection) => ({
            ...connection,
            failureReason:
              connection.failureReason ?? connection.questionSyncFailureReason,
          })),
        },
        syncs: {
          completedLast24Hours: syncCount(
            syncGroups,
            CatalogSyncStatus.COMPLETED,
          ),
          failedLast24Hours: syncCount(syncGroups, CatalogSyncStatus.FAILED),
          running: syncCount(syncGroups, CatalogSyncStatus.RUNNING),
        },
        recentErrors,
      };
    } catch (error) {
      return {
        status: 'DOWN' as HealthStatus,
        latencyMs: null as number | null,
        errorCode: databaseErrorCode(error),
        billing: emptyBillingHealth(),
        marketplaces: {
          issueCount: 0,
          providers: [],
          issues: [],
        },
        syncs: {
          completedLast24Hours: 0,
          failedLast24Hours: 0,
          running: 0,
        },
        recentErrors: [],
      };
    }
  }

  private async getRedisHealth() {
    const startedAt = Date.now();
    try {
      await this.productSyncQueue.getJobCounts('waiting');
      return {
        status: 'HEALTHY' as HealthStatus,
        latencyMs: Date.now() - startedAt,
        errorCode: null as string | null,
      };
    } catch (error) {
      return {
        status: 'DOWN' as HealthStatus,
        latencyMs: null as number | null,
        errorCode: redisErrorCode(error),
      };
    }
  }

  private getQueueHealth() {
    const queues = [
      {
        key: 'product-sync',
        label: 'Katalog ve stok',
        queue: this.productSyncQueue,
      },
      {
        key: 'question-sync',
        label: 'Soru toplama',
        queue: this.questionSyncQueue,
      },
      {
        key: 'question-draft',
        label: 'AI taslak',
        queue: this.questionDraftQueue,
      },
      {
        key: 'question-answer',
        label: 'Cevap gönderimi',
        queue: this.questionAnswerQueue,
      },
      { key: 'size-guide', label: 'Beden tablosu', queue: this.sizeGuideQueue },
      {
        key: 'paddle-webhooks',
        label: 'Paddle webhook',
        queue: this.paddleWebhookQueue,
      },
      {
        key: 'billing-recovery',
        label: 'Faturalama kontrolü',
        queue: this.billingRecoveryQueue,
      },
    ];

    return Promise.all(
      queues.map(async ({ key, label, queue }) => {
        try {
          const [counts, paused] = await Promise.all([
            queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
            queue.isPaused(),
          ]);
          return {
            key,
            label,
            available: true,
            paused,
            counts: {
              waiting: counts.waiting ?? 0,
              active: counts.active ?? 0,
              delayed: counts.delayed ?? 0,
              failed: counts.failed ?? 0,
            },
          };
        } catch {
          return {
            key,
            label,
            available: false,
            paused: false,
            counts: { waiting: 0, active: 0, delayed: 0, failed: 0 },
          };
        }
      }),
    );
  }
}

function overallStatus(input: {
  database: HealthStatus;
  redis: HealthStatus;
  unavailableQueues: number;
  pausedQueues: number;
  billingIssues: number;
  connectionIssues: number;
}): HealthStatus {
  if (input.database === 'DOWN' || input.redis === 'DOWN') return 'DOWN';
  if (
    input.unavailableQueues > 0 ||
    input.pausedQueues > 0 ||
    input.billingIssues > 0 ||
    input.connectionIssues > 0
  ) {
    return 'DEGRADED';
  }
  return 'HEALTHY';
}

function syncCount(
  groups: Array<{
    status: CatalogSyncStatus;
    _count: { _all: number };
  }>,
  status: CatalogSyncStatus,
) {
  return groups.find((group) => group.status === status)?._count._all ?? 0;
}

function emptyBillingHealth() {
  return {
    lastWebhook: null,
    webhookEventsLast24Hours: 0,
    webhookFailuresLast24Hours: 0,
    overdueReconciliations: 0,
    reconciliationFailures: 0,
  };
}

function databaseErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    return String(error.code);
  }
  return 'DATABASE_UNAVAILABLE';
}

function redisErrorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    return String(error.code);
  }
  return 'REDIS_UNAVAILABLE';
}
