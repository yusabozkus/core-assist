import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Prisma } from '../../generated/prisma/client';
import {
  CatalogSyncKind,
  CatalogSyncStatus,
  ChannelConnectionStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_RECOVERY_QUEUE } from '../billing/billing-reconciliation.processor';
import { PADDLE_WEBHOOK_QUEUE } from '../billing/paddle-webhook.constants';
import { getChannelSyncRetryEligibility } from '../channels/channel-sync-retry.policy';
import { ChannelsService } from '../channels/channels.service';
import { ProviderRegistryService } from '../channels/providers/provider-registry.service';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  auditErrorCode,
  AuditLogService,
  AuditOrigin,
  AuditResult,
} from '../audit/audit-log.service';
import {
  PRODUCT_SYNC_LOCK_TIMEOUT_MS,
  PRODUCT_SYNC_QUEUE,
} from '../product-sync/product-sync.constants';
import { QUESTION_ANSWER_QUEUE } from '../question-answer/question-answer.constants';
import {
  QUESTION_SYNC_LOCK_TIMEOUT_MS,
  QUESTION_SYNC_QUEUE,
} from '../question-sync/question-sync.constants';
import { QUESTION_DRAFT_QUEUE } from '../questions/question-draft.constants';
import { SIZE_GUIDE_QUEUE } from '../size-guides/size-guide.constants';
import { SUPPORT_NOTIFICATION_QUEUE } from '../support/support-notification.constants';
import { NOTIFICATION_EMAIL_DIGEST_QUEUE } from '../notifications/notification-email-digest.constants';
import { DATA_RETENTION_QUEUE } from '../data-retention/data-retention.constants';
import {
  countRecentQueueFailures,
  getQueueRuntimeThresholds,
  inspectQueueRuntime,
  inspectScheduledJobs,
} from './admin-queue-monitoring';
import {
  AdminOperationIssueFilter,
  AdminOperationOrder,
  AdminOperationPeriod,
  AdminOperationsQueryDto,
  AdminQueueFailuresQueryDto,
} from './dto/admin-operations-query.dto';

const DAY = 24 * 60 * 60 * 1000;
const QUEUE_READ_TIMEOUT_MS = 2_000;

const operationSelect = {
  id: true,
  kind: true,
  status: true,
  trigger: true,
  stage: true,
  progress: true,
  retryOfId: true,
  productsProcessed: true,
  productsCreated: true,
  productsUpdated: true,
  productsUnchanged: true,
  productsSkipped: true,
  batchesProcessed: true,
  fetchCompleted: true,
  variantsProcessed: true,
  variantsUpdated: true,
  variantsUnchanged: true,
  lowStockAlerts: true,
  outOfStockAlerts: true,
  questionsProcessed: true,
  questionsUnchanged: true,
  productsArchived: true,
  cursor: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  connection: {
    select: {
      id: true,
      providerKey: true,
      environment: true,
      status: true,
      credentialsEncrypted: true,
      failureReason: true,
      questionSyncFailureReason: true,
      connectedAt: true,
      removedAt: true,
      processingStartedAt: true,
      questionSyncStartedAt: true,
      store: {
        select: {
          id: true,
          name: true,
          status: true,
          workspace: {
            select: {
              id: true,
              name: true,
              owner: { select: { name: true, email: true } },
              billingSubscription: {
                select: {
                  status: true,
                  trialEndsAt: true,
                  currentPeriodEnd: true,
                  paddleSubscriptionId: true,
                  cancelAtPeriodEnd: true,
                  scheduledAccessEndsAt: true,
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CatalogSyncRunSelect;

type OperationRecord = Prisma.CatalogSyncRunGetPayload<{
  select: typeof operationSelect;
}>;

@Injectable()
export class AdminOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly providers: ProviderRegistryService,
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
    @InjectQueue(NOTIFICATION_EMAIL_DIGEST_QUEUE)
    private readonly notificationEmailDigestQueue: Queue,
    @InjectQueue(DATA_RETENTION_QUEUE)
    private readonly dataRetentionQueue: Queue,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: AdminOperationsQueryDto) {
    const now = new Date();
    const where = this.buildWhere(query, now);
    const dayAgo = new Date(now.getTime() - DAY);
    const recentWhere = {
      startedAt: { gte: dayAgo },
    } satisfies Prisma.CatalogSyncRunWhereInput;

    const [
      runs,
      total,
      all,
      running,
      failedLastDay,
      staleRunning,
      unhealthyConnections,
      recentStatuses,
      providerRows,
      queues,
    ] = await Promise.all([
      this.prisma.catalogSyncRun.findMany({
        where,
        select: operationSelect,
        orderBy: [
          {
            startedAt:
              query.order === AdminOperationOrder.OLDEST ? 'asc' : 'desc',
          },
          {
            id: query.order === AdminOperationOrder.OLDEST ? 'asc' : 'desc',
          },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.catalogSyncRun.count({ where }),
      this.prisma.catalogSyncRun.count(),
      this.prisma.catalogSyncRun.count({
        where: { status: CatalogSyncStatus.RUNNING },
      }),
      this.prisma.catalogSyncRun.count({
        where: { ...recentWhere, status: CatalogSyncStatus.FAILED },
      }),
      this.prisma.catalogSyncRun.count({ where: this.staleWhere(now) }),
      this.prisma.channelConnection.count({
        where: {
          removedAt: null,
          status: {
            in: [
              ChannelConnectionStatus.ERROR,
              ChannelConnectionStatus.DISCONNECTED,
            ],
          },
        },
      }),
      this.prisma.catalogSyncRun.groupBy({
        by: ['status'],
        where: recentWhere,
        _count: { _all: true },
      }),
      this.prisma.channelConnection.findMany({
        where: { removedAt: null, syncRuns: { some: {} } },
        distinct: ['providerKey'],
        orderBy: { providerKey: 'asc' },
        select: { providerKey: true },
      }),
      this.getQueueHealth(now),
    ]);

    const completedLastDay =
      recentStatuses.find(
        (group) => group.status === CatalogSyncStatus.COMPLETED,
      )?._count._all ?? 0;
    const failedInGroups =
      recentStatuses.find((group) => group.status === CatalogSyncStatus.FAILED)
        ?._count._all ?? 0;
    const finishedLastDay = completedLastDay + failedInGroups;
    const unavailableQueues = queues.filter((queue) => !queue.available).length;

    return {
      items: runs.map((run) => this.toItem(run, now)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      summary: {
        total: all,
        running,
        failedLastDay,
        staleRunning,
        unhealthyConnections,
        successRateLastDay:
          finishedLastDay === 0
            ? null
            : Math.round((completedLastDay / finishedLastDay) * 100),
        queueBacklog: unavailableQueues
          ? null
          : queues.reduce(
              (sum, queue) => sum + queue.counts.waiting + queue.counts.active,
              0,
            ),
        unavailableQueues,
      },
      providers: providerRows.map((row) => row.providerKey),
      queues,
      generatedAt: now,
    };
  }

  async retrySyncRun(syncRunId: string, adminUserId: string) {
    const run = await this.prisma.catalogSyncRun.findUnique({
      where: { id: syncRunId },
      select: {
        id: true,
        kind: true,
        status: true,
        connection: {
          select: {
            storeId: true,
            store: { select: { workspaceId: true } },
          },
        },
      },
    });

    const auditBase = {
      actorType: AuditActorType.ADMIN,
      actorUserId: adminUserId,
      origin: AuditOrigin.API,
      action: AuditAction.ADMIN_SYNC_RETRY,
      workspaceId: run?.connection.store.workspaceId,
      storeId: run?.connection.storeId,
      targetType: 'CATALOG_SYNC_RUN',
      targetId: syncRunId,
      before: run ? { kind: run.kind, status: run.status } : undefined,
    } as const;
    await this.audit.record({ ...auditBase, result: AuditResult.STARTED });

    try {
      const result = await this.channels.retrySyncRunAsAdmin(syncRunId);
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.SUCCESS,
        after: {
          syncRunId: result.syncRunId,
          status: result.status,
          kind: run?.kind,
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

  async findQueueDetail(queueKey: string, query: AdminQueueFailuresQueryDto) {
    const definition = this.getQueueDefinitions().find(
      (queue) => queue.key === queueKey,
    );
    if (!definition) {
      throw new NotFoundException('Worker kuyruğu bulunamadı.');
    }

    const now = new Date();
    const start = (query.page - 1) * query.pageSize;
    const end = start + query.pageSize - 1;

    let result: Awaited<ReturnType<typeof readQueueDetail>>;
    try {
      result = await withQueueTimeout(
        readQueueDetail(definition.queue, definition.key, start, end, now),
        definition.key,
      );
    } catch (error) {
      return unavailableQueueDetail(
        definition.key,
        definition.label,
        query,
        now,
        queueErrorCode(error),
      );
    }

    const {
      counts,
      paused,
      recentFailuresLast24Hours,
      failures,
      scheduledJobs,
      runtime,
    } = result;
    const total = counts.failed ?? 0;

    return {
      key: definition.key,
      label: definition.label,
      available: true,
      errorCode: null,
      paused,
      recentFailuresLast24Hours,
      ...runtime,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        scheduled: counts.delayed ?? 0,
        overdue: scheduledJobs.overdue,
        failed: total,
      },
      scheduledJobs: scheduledJobs.jobs.slice(0, 50),
      failures: failures.map(toQueueFailure),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      generatedAt: now,
    };
  }

  private buildWhere(
    query: AdminOperationsQueryDto,
    now: Date,
  ): Prisma.CatalogSyncRunWhereInput {
    const conditions: Prisma.CatalogSyncRunWhereInput[] = [];
    if (query.q) {
      conditions.push({
        OR: [
          { id: { contains: query.q, mode: 'insensitive' } },
          { errorMessage: { contains: query.q, mode: 'insensitive' } },
          {
            connection: {
              OR: [
                {
                  providerKey: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  store: {
                    OR: [
                      {
                        name: {
                          contains: query.q,
                          mode: 'insensitive',
                        },
                      },
                      {
                        workspace: {
                          OR: [
                            {
                              name: {
                                contains: query.q,
                                mode: 'insensitive',
                              },
                            },
                            {
                              owner: {
                                is: {
                                  email: {
                                    contains: query.q,
                                    mode: 'insensitive',
                                  },
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });
    }
    if (query.status) conditions.push({ status: query.status });
    if (query.kind) conditions.push({ kind: query.kind });
    if (query.provider) {
      conditions.push({ connection: { providerKey: query.provider } });
    }
    if (query.environment) {
      conditions.push({ connection: { environment: query.environment } });
    }
    if (query.issue === AdminOperationIssueFilter.STALE) {
      conditions.push(this.staleWhere(now));
    } else if (query.issue === AdminOperationIssueFilter.CONNECTION) {
      conditions.push({
        connection: {
          status: {
            in: [
              ChannelConnectionStatus.ERROR,
              ChannelConnectionStatus.DISCONNECTED,
            ],
          },
        },
      });
    }
    const periodStart = resolvePeriodStart(query.period, now);
    if (periodStart) conditions.push({ startedAt: { gte: periodStart } });
    return conditions.length ? { AND: conditions } : {};
  }

  private staleWhere(now: Date): Prisma.CatalogSyncRunWhereInput {
    return {
      status: CatalogSyncStatus.RUNNING,
      OR: [
        {
          kind: CatalogSyncKind.QUESTION,
          updatedAt: {
            lt: new Date(now.getTime() - QUESTION_SYNC_LOCK_TIMEOUT_MS),
          },
        },
        {
          kind: { in: [CatalogSyncKind.FULL, CatalogSyncKind.INVENTORY] },
          updatedAt: {
            lt: new Date(now.getTime() - PRODUCT_SYNC_LOCK_TIMEOUT_MS),
          },
        },
      ],
    };
  }

  private toItem(run: OperationRecord, now: Date) {
    const stale = isStaleRun(run, now);
    const connectionFailure =
      run.connection.failureReason ?? run.connection.questionSyncFailureReason;
    const retryEligibility = getChannelSyncRetryEligibility(
      {
        runStatus: run.status,
        kind: run.kind,
        storeStatus: run.connection.store.status,
        connectionStatus: run.connection.status,
        credentialsEncrypted: run.connection.credentialsEncrypted,
        connectedAt: run.connection.connectedAt,
        removedAt: run.connection.removedAt,
        processingStartedAt: run.connection.processingStartedAt,
        questionSyncStartedAt: run.connection.questionSyncStartedAt,
        supportsProductQuestions: this.providers.supportsProductQuestions(
          run.connection.providerKey,
        ),
        subscription: run.connection.store.workspace.billingSubscription,
      },
      now,
    );
    return {
      id: run.id,
      kind: run.kind,
      status: run.status,
      trigger: run.trigger,
      stage: run.stage,
      progress: run.progress,
      retryOfId: run.retryOfId,
      metrics: {
        productsProcessed: run.productsProcessed,
        productsCreated: run.productsCreated,
        productsUpdated: run.productsUpdated,
        productsUnchanged: run.productsUnchanged,
        productsSkipped: run.productsSkipped,
        productsArchived: run.productsArchived,
        batchesProcessed: run.batchesProcessed,
        variantsProcessed: run.variantsProcessed,
        variantsUpdated: run.variantsUpdated,
        variantsUnchanged: run.variantsUnchanged,
        questionsProcessed: run.questionsProcessed,
        questionsUnchanged: run.questionsUnchanged,
        lowStockAlerts: run.lowStockAlerts,
        outOfStockAlerts: run.outOfStockAlerts,
      },
      fetchCompleted: run.fetchCompleted,
      cursor: run.cursor,
      errorMessage: run.errorMessage,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      updatedAt: run.updatedAt,
      durationMs:
        (run.completedAt?.getTime() ?? now.getTime()) - run.startedAt.getTime(),
      isStale: stale,
      canRetry: retryEligibility.canRetry,
      retryBlockedReason: retryEligibility.reason,
      connection: {
        id: run.connection.id,
        providerKey: run.connection.providerKey,
        environment: run.connection.environment,
        status: run.connection.status,
        failureReason: connectionFailure,
      },
      store: {
        id: run.connection.store.id,
        name: run.connection.store.name,
        status: run.connection.store.status,
        workspace: {
          id: run.connection.store.workspace.id,
          name: run.connection.store.workspace.name,
          owner: run.connection.store.workspace.owner,
        },
      },
    };
  }

  private getQueueHealth(now: Date) {
    return Promise.all(
      this.getQueueDefinitions().map(async ({ key, label, queue }) => {
        try {
          const failedSince = now.getTime() - DAY;
          const [
            counts,
            paused,
            recentFailuresLast24Hours,
            scheduledJobs,
            runtime,
          ] = await withQueueTimeout(
            Promise.all([
              queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
              queue.isPaused(),
              countRecentQueueFailures(queue, failedSince),
              inspectScheduledJobs(queue, now.getTime()),
              inspectQueueRuntime(queue, key, now.getTime()),
            ]),
            key,
          );
          return {
            key,
            label,
            available: true,
            errorCode: null,
            paused,
            recentFailuresLast24Hours,
            ...runtime,
            counts: {
              waiting: counts.waiting ?? 0,
              active: counts.active ?? 0,
              scheduled: counts.delayed ?? 0,
              overdue: scheduledJobs.overdue,
              failed: counts.failed ?? 0,
            },
          };
        } catch (error) {
          return {
            key,
            label,
            available: false,
            errorCode: queueErrorCode(error),
            paused: false,
            recentFailuresLast24Hours: 0,
            ...unavailableQueueRuntime(key),
            counts: {
              waiting: 0,
              active: 0,
              scheduled: 0,
              overdue: 0,
              failed: 0,
            },
          };
        }
      }),
    );
  }

  private getQueueDefinitions() {
    return [
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
      {
        key: 'support-notifications',
        label: 'Destek bildirimleri',
        queue: this.supportNotificationQueue,
      },
      {
        key: 'notification-email-digest',
        label: 'E-posta özetleri',
        queue: this.notificationEmailDigestQueue,
      },
      {
        key: 'data-retention',
        label: 'Veri saklama',
        queue: this.dataRetentionQueue,
      },
    ];
  }
}

function sanitizeQueueFailureReason(reason: string | undefined) {
  const normalized = reason?.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Hata ayrıntısı worker tarafından kaydedilmedi.';
  return normalized.slice(0, 1_000);
}

function toQueueFailure(job: {
  id?: string;
  name: string;
  failedReason?: string;
  attemptsMade: number;
  finishedOn?: number;
  timestamp: number;
}) {
  return {
    id: String(job.id ?? 'unknown'),
    name: job.name,
    failedReason: sanitizeQueueFailureReason(job.failedReason),
    attemptsMade: job.attemptsMade,
    failedAt: new Date(job.finishedOn ?? job.timestamp),
  };
}

async function readQueueDetail(
  queue: Queue,
  queueKey: string,
  start: number,
  end: number,
  now: Date,
) {
  const [
    counts,
    paused,
    recentFailuresLast24Hours,
    failures,
    scheduledJobs,
    runtime,
  ] = await Promise.all([
    queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
    queue.isPaused(),
    countRecentQueueFailures(queue, now.getTime() - DAY),
    queue.getJobs(['failed'], start, end, false),
    inspectScheduledJobs(queue, now.getTime()),
    inspectQueueRuntime(queue, queueKey, now.getTime()),
  ]);

  return {
    counts,
    paused,
    recentFailuresLast24Hours,
    failures,
    scheduledJobs,
    runtime,
  };
}

function unavailableQueueDetail(
  key: string,
  label: string,
  query: AdminQueueFailuresQueryDto,
  now: Date,
  errorCode: string,
) {
  return {
    key,
    label,
    available: false,
    errorCode,
    paused: false,
    recentFailuresLast24Hours: 0,
    ...unavailableQueueRuntime(key),
    counts: emptyQueueCounts(),
    scheduledJobs: [],
    failures: [],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total: 0,
      totalPages: 1,
    },
    generatedAt: now,
  };
}

function unavailableQueueRuntime(queueKey: string) {
  const thresholds = getQueueRuntimeThresholds(queueKey);
  return {
    workerCount: null,
    workerUnavailable: false,
    oldestWaitingAgeMs: null,
    longestActiveAgeMs: null,
    waitingAgeWarningMs: thresholds.waitingAgeWarningMs,
    activeDurationWarningMs: thresholds.activeDurationWarningMs,
    activeStallWarningMs: thresholds.activeStallWarningMs,
    waitingAgeExceeded: false,
    activeDurationExceeded: false,
    stalledActiveJobs: 0,
  };
}

function emptyQueueCounts() {
  return {
    waiting: 0,
    active: 0,
    scheduled: 0,
    overdue: 0,
    failed: 0,
  };
}

async function withQueueTimeout<T>(promise: Promise<T>, queueKey: string) {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new QueueReadTimeoutError(queueKey)),
      QUEUE_READ_TIMEOUT_MS,
    );
    timeoutId.unref();
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function queueErrorCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code.slice(0, 120);
  }
  return 'QUEUE_UNAVAILABLE';
}

class QueueReadTimeoutError extends Error {
  readonly code: string;

  constructor(queueKey: string) {
    const code = `QUEUE_TIMEOUT:${queueKey}`;
    super(code);
    this.name = 'QueueReadTimeoutError';
    this.code = code;
  }
}

function resolvePeriodStart(
  period: AdminOperationPeriod | undefined,
  now: Date,
) {
  if (period === AdminOperationPeriod.DAY) {
    return new Date(now.getTime() - DAY);
  }
  if (period === AdminOperationPeriod.WEEK) {
    return new Date(now.getTime() - 7 * DAY);
  }
  if (period === AdminOperationPeriod.MONTH) {
    return new Date(now.getTime() - 30 * DAY);
  }
  return null;
}

function isStaleRun(run: OperationRecord, now: Date) {
  if (run.status !== CatalogSyncStatus.RUNNING) return false;
  const timeout =
    run.kind === CatalogSyncKind.QUESTION
      ? QUESTION_SYNC_LOCK_TIMEOUT_MS
      : PRODUCT_SYNC_LOCK_TIMEOUT_MS;
  return run.updatedAt.getTime() < now.getTime() - timeout;
}
