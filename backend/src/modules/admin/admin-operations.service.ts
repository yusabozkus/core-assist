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
import { ChannelsService } from '../channels/channels.service';
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
import {
  AdminOperationIssueFilter,
  AdminOperationOrder,
  AdminOperationPeriod,
  AdminOperationsQueryDto,
  AdminQueueFailuresQueryDto,
} from './dto/admin-operations-query.dto';

const DAY = 24 * 60 * 60 * 1000;

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
      removedAt: true,
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
        queueBacklog: queues.reduce(
          (sum, queue) => sum + queue.counts.waiting + queue.counts.active,
          0,
        ),
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

  async findQueueFailures(queueKey: string, query: AdminQueueFailuresQueryDto) {
    const definition = this.getQueueDefinitions().find(
      (queue) => queue.key === queueKey,
    );
    if (!definition) {
      throw new NotFoundException('Worker kuyruğu bulunamadı.');
    }

    const now = new Date();
    const counts = await definition.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
    );
    const total = counts.failed ?? 0;
    const start = (query.page - 1) * query.pageSize;
    const end = start + query.pageSize - 1;
    const [paused, recentFailuresLast24Hours, failures] = await Promise.all([
      definition.queue.isPaused(),
      countRecentQueueFailures(definition.queue, now.getTime() - DAY),
      definition.queue.getJobs(['failed'], start, end, false),
    ]);

    return {
      key: definition.key,
      label: definition.label,
      available: true,
      paused,
      recentFailuresLast24Hours,
      counts: {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: total,
      },
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
      canRetry:
        run.status === CatalogSyncStatus.FAILED &&
        run.connection.store.status === 'ACTIVE' &&
        run.connection.status !== ChannelConnectionStatus.DISCONNECTED &&
        Boolean(run.connection.credentialsEncrypted) &&
        !run.connection.removedAt,
      connection: {
        id: run.connection.id,
        providerKey: run.connection.providerKey,
        environment: run.connection.environment,
        status: run.connection.status,
        failureReason: connectionFailure,
      },
      store: run.connection.store,
    };
  }

  private getQueueHealth(now: Date) {
    return Promise.all(
      this.getQueueDefinitions().map(async ({ key, label, queue }) => {
        try {
          const failedSince = now.getTime() - DAY;
          const [counts, paused, recentFailuresLast24Hours] = await Promise.all(
            [
              queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
              queue.isPaused(),
              countRecentQueueFailures(queue, failedSince),
            ],
          );
          return {
            key,
            label,
            available: true,
            paused,
            recentFailuresLast24Hours,
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
            recentFailuresLast24Hours: 0,
            counts: { waiting: 0, active: 0, delayed: 0, failed: 0 },
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

async function countRecentQueueFailures(queue: Queue, failedSince: number) {
  const client = await queue.getBackend().connection.client;
  const entries = await client.zrange(queue.toKey('failed'), 0, -1, {
    WITHSCORES: true,
  });
  let count = 0;
  for (let index = 1; index < entries.length; index += 2) {
    if (Number(entries[index]) >= failedSince) count += 1;
  }
  return count;
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
