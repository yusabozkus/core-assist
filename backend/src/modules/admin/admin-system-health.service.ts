import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  AuditResult,
  CatalogSyncStatus,
  ChannelConnectionStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_RECOVERY_QUEUE } from '../billing/billing-reconciliation.processor';
import { billingReconciliationTargetWhere } from '../billing/billing-reconciliation.policy';
import { PADDLE_WEBHOOK_QUEUE } from '../billing/paddle-webhook.constants';
import { PRODUCT_SYNC_QUEUE } from '../product-sync/product-sync.constants';
import { QUESTION_ANSWER_QUEUE } from '../question-answer/question-answer.constants';
import { QUESTION_SYNC_QUEUE } from '../question-sync/question-sync.constants';
import { QUESTION_DRAFT_QUEUE } from '../questions/question-draft.constants';
import { SIZE_GUIDE_QUEUE } from '../size-guides/size-guide.constants';
import { SUPPORT_NOTIFICATION_QUEUE } from '../support/support-notification.constants';
import { inspectScheduledJobs } from './admin-queue-monitoring';

const DAY = 24 * 60 * 60 * 1000;
const RECONCILIATION_GRACE_MS = 15 * 60 * 1000;
const HEALTH_CACHE_MS = 15 * 1000;
const HEADER_HEALTH_TIMEOUT_MS = 2_500;
const HEALTH_REQUEST_TIMEOUT_MS = 5_000;
const DATABASE_HEALTH_TIMEOUT_MS = 4_000;
const REDIS_HEALTH_TIMEOUT_MS = 1_500;
const QUEUE_HEALTH_TIMEOUT_MS = 2_000;
const DATABASE_SLOW_THRESHOLD_MS = 750;
const REDIS_SLOW_THRESHOLD_MS = 300;
const RECENT_FAILED_JOB_LIMIT = 100;

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';

type QueueDefinition = {
  key: string;
  label: string;
  queue: Queue;
  backlogWarningThreshold: number;
};

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
    @InjectQueue(SUPPORT_NOTIFICATION_QUEUE)
    private readonly supportNotificationQueue: Queue,
  ) {}

  async getHealth() {
    if (this.cachedHealth && this.cachedHealth.expiresAt > Date.now()) {
      return this.cachedHealth.value;
    }
    if (this.healthRequest) return this.healthRequest;

    const request = withTimeout(
      this.collectHealthSnapshot(),
      HEALTH_REQUEST_TIMEOUT_MS,
      'HEALTH_CHECK_TIMEOUT',
    ).catch((error) =>
      this.createUnavailableHealthSnapshot(healthErrorCode(error)),
    );
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

      const serviceIssues = Object.values(health.services).filter(
        (service) => service.status !== 'HEALTHY',
      ).length;

      return {
        status: health.status,
        issueCount:
          serviceIssues +
          health.summary.unavailableQueues +
          health.summary.pausedQueues +
          health.summary.backloggedQueues +
          health.summary.queuesWithOverdueJobs +
          health.summary.queuesWithRecentFailures +
          health.summary.failedSyncsLast24Hours +
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
      withTimeout(
        this.getDatabaseSnapshot(now),
        DATABASE_HEALTH_TIMEOUT_MS,
        'DATABASE_TIMEOUT',
      ).catch((error) => unavailableDatabase(healthErrorCode(error))),
      withTimeout(
        this.getRedisHealth(),
        REDIS_HEALTH_TIMEOUT_MS,
        'REDIS_TIMEOUT',
      ).catch((error) => unavailableRedis(healthErrorCode(error))),
      this.getQueueHealth(),
    ]);
    const queueBacklog = queues.reduce(
      (total, queue) => total + queue.counts.waiting,
      0,
    );
    const unavailableQueues = queues.filter((queue) => !queue.available).length;
    const pausedQueues = queues.filter((queue) => queue.paused).length;
    const backloggedQueues = queues.filter(
      (queue) => queue.backlogExceeded,
    ).length;
    const queuesWithOverdueJobs = queues.filter(
      (queue) => queue.counts.overdue > 0,
    ).length;
    const queuesWithRecentFailures = queues.filter(
      (queue) => queue.recentFailuresLast24Hours > 0,
    ).length;
    const retainedQueueFailures = queues.reduce(
      (total, queue) => total + queue.counts.failed,
      0,
    );
    const recentQueueFailures = queues.reduce(
      (total, queue) => total + queue.recentFailuresLast24Hours,
      0,
    );
    const billingIssues =
      database.billing.webhookFailuresLast24Hours +
      database.billing.overdueReconciliations +
      database.billing.reconciliationFailures;
    const status = overallStatus({
      database: database.status,
      redis: redis.status,
      unavailableQueues,
      pausedQueues,
      backloggedQueues,
      queuesWithOverdueJobs,
      queuesWithRecentFailures,
      failedSyncsLast24Hours: database.syncs.failedLast24Hours,
      billingIssues,
      connectionIssues: database.marketplaces.issueCount,
    });

    return {
      status,
      services: {
        api: { status: 'HEALTHY' as HealthStatus },
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
        backloggedQueues,
        queuesWithOverdueJobs,
        queuesWithRecentFailures,
        retainedQueueFailures,
        recentQueueFailures,
        failedSyncsLast24Hours: database.syncs.failedLast24Hours,
        connectionIssues: database.marketplaces.issueCount,
        billingIssues,
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
      const reconciliationTarget = billingReconciliationTargetWhere();
      const overdueReconciliationWhere = {
        AND: [
          reconciliationTarget,
          { reconcileAfter: { lt: overdueReconcileBefore } },
        ],
      };
      const failedReconciliationWhere = {
        AND: [
          reconciliationTarget,
          {
            OR: [
              { reconcileFailures: { gt: 0 } },
              { reconcileErrorCode: { not: null } },
            ],
          },
        ],
      };
      const [
        lastWebhook,
        webhookEventsLastDay,
        webhookFailuresLastDay,
        overdueReconciliations,
        reconciliationFailures,
        reconciliationIssues,
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
          where: overdueReconciliationWhere,
        }),
        this.prisma.billingSubscription.count({
          where: failedReconciliationWhere,
        }),
        this.prisma.billingSubscription.findMany({
          where: {
            AND: [
              reconciliationTarget,
              {
                OR: [
                  { reconcileAfter: { lt: overdueReconcileBefore } },
                  { reconcileFailures: { gt: 0 } },
                  { reconcileErrorCode: { not: null } },
                ],
              },
            ],
          },
          select: {
            id: true,
            workspaceId: true,
            plan: true,
            status: true,
            paddleSubscriptionId: true,
            reconcileAfter: true,
            lastReconciledAt: true,
            reconcileFailures: true,
            reconcileErrorCode: true,
            workspace: {
              select: {
                owner: {
                  select: { id: true, name: true, email: true },
                },
              },
            },
          },
          orderBy: [{ reconcileFailures: 'desc' }, { reconcileAfter: 'asc' }],
          take: 8,
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
        status:
          latencyMs >= DATABASE_SLOW_THRESHOLD_MS
            ? ('DEGRADED' as HealthStatus)
            : ('HEALTHY' as HealthStatus),
        latencyMs,
        errorCode: null as string | null,
        billing: {
          lastWebhook,
          webhookEventsLast24Hours: webhookEventsLastDay,
          webhookFailuresLast24Hours: webhookFailuresLastDay,
          overdueReconciliations,
          reconciliationFailures,
          reconciliationIssues: reconciliationIssues.map((issue) => ({
            id: issue.id,
            workspaceId: issue.workspaceId,
            owner: issue.workspace.owner,
            plan: issue.plan,
            status: issue.status,
            paddleSubscriptionId: issue.paddleSubscriptionId,
            reconcileAfter: issue.reconcileAfter,
            lastReconciledAt: issue.lastReconciledAt,
            reconcileFailures: issue.reconcileFailures,
            reconcileErrorCode: issue.reconcileErrorCode,
            issueTypes: [
              ...(issue.reconcileAfter < overdueReconcileBefore
                ? (['OVERDUE'] as const)
                : []),
              ...(issue.reconcileFailures > 0 || issue.reconcileErrorCode
                ? (['FAILED'] as const)
                : []),
            ],
          })),
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
      const latencyMs = Date.now() - startedAt;
      return {
        status:
          latencyMs >= REDIS_SLOW_THRESHOLD_MS
            ? ('DEGRADED' as HealthStatus)
            : ('HEALTHY' as HealthStatus),
        latencyMs,
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
    const queues = this.getQueueDefinitions();
    const failedSince = Date.now() - DAY;

    return Promise.all(
      queues.map(async ({ key, label, queue, backlogWarningThreshold }) => {
        try {
          const [counts, paused, failedJobs, scheduledJobs] = await withTimeout(
            Promise.all([
              queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
              queue.isPaused(),
              queue.getJobs(['failed'], 0, RECENT_FAILED_JOB_LIMIT - 1, false),
              inspectScheduledJobs(queue),
            ]),
            QUEUE_HEALTH_TIMEOUT_MS,
            `QUEUE_TIMEOUT:${key}`,
          );
          const recentFailuresLast24Hours = failedJobs.filter(
            (job) => (job.finishedOn ?? job.timestamp) >= failedSince,
          ).length;
          const waiting = counts.waiting ?? 0;
          const backlogExceeded = waiting >= backlogWarningThreshold;
          const status: HealthStatus =
            paused ||
            backlogExceeded ||
            scheduledJobs.overdue > 0 ||
            recentFailuresLast24Hours > 0
              ? 'DEGRADED'
              : 'HEALTHY';

          return {
            key,
            label,
            status,
            available: true,
            paused,
            backlogWarningThreshold,
            backlogExceeded,
            recentFailuresLast24Hours,
            errorCode: null as string | null,
            counts: {
              waiting,
              active: counts.active ?? 0,
              scheduled: counts.delayed ?? 0,
              overdue: scheduledJobs.overdue,
              failed: counts.failed ?? 0,
            },
          };
        } catch (error) {
          return unavailableQueue(
            key,
            label,
            backlogWarningThreshold,
            healthErrorCode(error, 'QUEUE_UNAVAILABLE'),
          );
        }
      }),
    );
  }

  private getQueueDefinitions(): QueueDefinition[] {
    return [
      {
        key: 'product-sync',
        label: 'Katalog ve stok',
        queue: this.productSyncQueue,
        backlogWarningThreshold: 25,
      },
      {
        key: 'question-sync',
        label: 'Soru toplama',
        queue: this.questionSyncQueue,
        backlogWarningThreshold: 50,
      },
      {
        key: 'question-draft',
        label: 'AI taslak',
        queue: this.questionDraftQueue,
        backlogWarningThreshold: 250,
      },
      {
        key: 'question-answer',
        label: 'Cevap gönderimi',
        queue: this.questionAnswerQueue,
        backlogWarningThreshold: 100,
      },
      {
        key: 'size-guide',
        label: 'Beden tablosu',
        queue: this.sizeGuideQueue,
        backlogWarningThreshold: 100,
      },
      {
        key: 'paddle-webhooks',
        label: 'Paddle webhook',
        queue: this.paddleWebhookQueue,
        backlogWarningThreshold: 50,
      },
      {
        key: 'billing-recovery',
        label: 'Faturalama kontrolü',
        queue: this.billingRecoveryQueue,
        backlogWarningThreshold: 50,
      },
      {
        key: 'support-notifications',
        label: 'Destek bildirimleri',
        queue: this.supportNotificationQueue,
        backlogWarningThreshold: 50,
      },
    ];
  }

  private createUnavailableHealthSnapshot(
    errorCode: string,
  ): Awaited<ReturnType<AdminSystemHealthService['collectHealthSnapshot']>> {
    const now = new Date();
    const queues = this.getQueueDefinitions().map((queue) =>
      unavailableQueue(
        queue.key,
        queue.label,
        queue.backlogWarningThreshold,
        errorCode,
      ),
    );

    return {
      status: 'DOWN',
      services: {
        api: { status: 'DOWN' },
        database: {
          status: 'DOWN',
          latencyMs: null,
          errorCode,
        },
        redis: unavailableRedis(errorCode),
      },
      queues,
      summary: {
        queueBacklog: 0,
        unavailableQueues: queues.length,
        pausedQueues: 0,
        backloggedQueues: 0,
        queuesWithOverdueJobs: 0,
        queuesWithRecentFailures: 0,
        retainedQueueFailures: 0,
        recentQueueFailures: 0,
        failedSyncsLast24Hours: 0,
        connectionIssues: 0,
        billingIssues: 0,
      },
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
      generatedAt: now,
    };
  }
}

function overallStatus(input: {
  database: HealthStatus;
  redis: HealthStatus;
  unavailableQueues: number;
  pausedQueues: number;
  backloggedQueues: number;
  queuesWithOverdueJobs: number;
  queuesWithRecentFailures: number;
  failedSyncsLast24Hours: number;
  billingIssues: number;
  connectionIssues: number;
}): HealthStatus {
  if (
    input.database === 'DOWN' ||
    input.redis === 'DOWN' ||
    input.unavailableQueues > 0
  ) {
    return 'DOWN';
  }
  if (
    input.database === 'DEGRADED' ||
    input.redis === 'DEGRADED' ||
    input.pausedQueues > 0 ||
    input.backloggedQueues > 0 ||
    input.queuesWithOverdueJobs > 0 ||
    input.queuesWithRecentFailures > 0 ||
    input.failedSyncsLast24Hours > 0 ||
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
    reconciliationIssues: [],
  };
}

function databaseErrorCode(error: unknown) {
  return healthErrorCode(error, 'DATABASE_UNAVAILABLE');
}

function redisErrorCode(error: unknown) {
  return healthErrorCode(error, 'REDIS_UNAVAILABLE');
}

function healthErrorCode(error: unknown, fallback = 'HEALTH_CHECK_FAILED') {
  if (typeof error === 'object' && error && 'code' in error) {
    return String(error.code);
  }
  return fallback;
}

function unavailableDatabase(errorCode: string) {
  return {
    status: 'DOWN' as HealthStatus,
    latencyMs: null as number | null,
    errorCode,
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

function unavailableRedis(errorCode: string) {
  return {
    status: 'DOWN' as HealthStatus,
    latencyMs: null as number | null,
    errorCode,
  };
}

function unavailableQueue(
  key: string,
  label: string,
  backlogWarningThreshold: number,
  errorCode: string,
) {
  return {
    key,
    label,
    status: 'DOWN' as HealthStatus,
    available: false,
    paused: false,
    backlogWarningThreshold,
    backlogExceeded: false,
    recentFailuresLast24Hours: 0,
    errorCode,
    counts: {
      waiting: 0,
      active: 0,
      scheduled: 0,
      overdue: 0,
      failed: 0,
    },
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  code: string,
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new HealthTimeoutError(code)),
      timeoutMs,
    );
    timeoutId.unref();
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

class HealthTimeoutError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'HealthTimeoutError';
    this.code = code;
  }
}
