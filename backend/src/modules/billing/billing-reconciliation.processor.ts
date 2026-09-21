import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { HttpException, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { failedJobRetention } from '../../infrastructure/queue/queue-retention';
import { NotificationsService } from '../notifications/notifications.service';
import { hasBillingAccess } from './billing-access.policy';
import { PaddleBillingService } from './paddle-billing.service';
import { paddleCheckoutEnvironment } from './paddle-billing.config';
import { PaddlePlanChangeService } from './paddle-plan-change.service';
import { BillingRetentionService } from './billing-retention.service';

export const BILLING_RECOVERY_QUEUE = 'billing-recovery';
const RECONCILE_BILLING = 'RECONCILE_BILLING';
const CLEANUP_BILLING_RECORDS = 'CLEANUP_BILLING_RECORDS';
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

@Processor(BILLING_RECOVERY_QUEUE, { concurrency: 1 })
export class BillingReconciliationProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(BillingReconciliationProcessor.name);

  constructor(
    @InjectQueue(BILLING_RECOVERY_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleBillingService,
    private readonly planChanges: PaddlePlanChangeService,
    private readonly notifications: NotificationsService,
    private readonly retention: BillingRetentionService,
  ) {
    super();
  }

  async onModuleInit() {
    await Promise.all([
      this.queue.upsertJobScheduler(
        'billing-reconciliation',
        { every: MINUTE },
        {
          name: RECONCILE_BILLING,
          data: {},
          opts: {
            removeOnComplete: true,
            removeOnFail: failedJobRetention(25),
          },
        },
      ),
      this.queue.upsertJobScheduler(
        'billing-retention-cleanup',
        { every: DAY },
        {
          name: CLEANUP_BILLING_RECORDS,
          data: {},
          opts: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: true,
            removeOnFail: failedJobRetention(25),
          },
        },
      ),
    ]);
  }

  async process(job: Job) {
    if (job.name === CLEANUP_BILLING_RECORDS) return this.retention.cleanup();
    if (job.name !== RECONCILE_BILLING)
      throw new Error('Unsupported billing recovery job');
    if (!process.env.PADDLE_API_KEY?.trim()) return { configured: false };
    const now = new Date();
    const scheduledPlanChanges = await this.prisma.billingPlanChange.findMany({
      where: {
        status: 'RETRY_SCHEDULED',
        retryAt: { lte: now },
      },
      orderBy: [{ retryAt: 'asc' }, { id: 'asc' }],
      take: 20,
      select: { id: true },
    });
    let planChangesRetried = 0;
    for (const change of scheduledPlanChanges) {
      if (await this.planChanges.retryScheduled(change.id))
        planChangesRetried += 1;
    }
    const candidates = await this.prisma.billingSubscription.findMany({
      where: {
        reconcileAfter: { lte: now },
        OR: [
          { paddleSubscriptionId: { not: null } },
          {
            workspace: {
              billingCheckouts: {
                some: {
                  environment: paddleCheckoutEnvironment(),
                  status: 'OPEN',
                  paddleTransactionId: { not: null },
                  boundAt: null,
                },
              },
            },
          },
        ],
      },
      orderBy: [{ reconcileAfter: 'asc' }, { id: 'asc' }],
      take: 20,
      select: {
        id: true,
        workspaceId: true,
        reconcileAfter: true,
        reconcileFailures: true,
        workspace: {
          select: {
            billingCheckouts: {
              where: {
                environment: paddleCheckoutEnvironment(),
                status: 'OPEN',
                boundAt: null,
              },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    for (const candidate of candidates) {
      // A DB lease also protects multiple worker processes and recovers crashes.
      const leaseEnd = new Date(Date.now() + 5 * MINUTE);
      const claimed = await this.prisma.billingSubscription.updateMany({
        where: { id: candidate.id, reconcileAfter: candidate.reconcileAfter },
        data: { reconcileAfter: leaseEnd },
      });
      if (claimed.count !== 1) continue;
      try {
        await this.paddle.reconcileWorkspace(candidate.workspaceId);
        const current = await this.prisma.billingSubscription.findUnique({
          where: { id: candidate.id },
          include: {
            workspace: {
              select: {
                billingPlanChanges: {
                  where: {
                    status: { in: ['AWAITING_WEBHOOK', 'REVIEW_REQUIRED'] },
                  },
                  take: 1,
                  select: { id: true },
                },
              },
            },
          },
        });
        if (!current) continue;
        const checkedAt = new Date();
        const urgent =
          candidate.workspace.billingCheckouts.length > 0 ||
          current.workspace.billingPlanChanges.length > 0 ||
          current.status === 'PAST_DUE' ||
          !current.paddleSubscriptionId ||
          Math.abs(current.currentPeriodEnd.getTime() - checkedAt.getTime()) <
            24 * 60 * MINUTE;
        const notificationUserIds = await this.prisma.$transaction(
          async (transaction) => {
            const saved = await transaction.billingSubscription.updateMany({
              where: {
                id: current.id,
                reconcileAfter: leaseEnd,
                updatedAt: current.updatedAt,
              },
              data: {
                lastReconciledAt: checkedAt,
                reconcileAfter: new Date(
                  checkedAt.getTime() + (urgent ? 5 : 60) * MINUTE,
                ),
                reconcileFailures: 0,
                reconcileErrorCode: null,
              },
            });
            if (
              saved.count === 1 &&
              current.status === 'ACTIVE' &&
              !current.cancelAtPeriodEnd &&
              !current.scheduledAccessEndsAt &&
              !hasBillingAccess(current, checkedAt)
            ) {
              return this.notifications.createBillingIssue(
                transaction,
                current.workspaceId,
                {
                  title: 'Abonelik yenilemesi doğrulanmayı bekliyor',
                  message:
                    'Kısa bekleme süresi doldu ancak yeni abonelik dönemi henüz doğrulanamadı. Tekrar satın almayın; Plan ve faturalar bölümünden ödeme durumunuzu kontrol edin. Kontroller otomatik olarak devam ediyor.',
                  dedupeKey: `billing-renewal:${current.id}:${current.currentPeriodEnd.toISOString()}`,
                },
              );
            }
            return [];
          },
        );
        this.notifications.emitBillingChange(notificationUserIds);
      } catch (error) {
        const code = reconciliationFailureCode(error);
        const failures = candidate.reconcileFailures + 1;
        await this.prisma.billingSubscription.updateMany({
          where: { id: candidate.id, reconcileAfter: leaseEnd },
          data: {
            reconcileFailures: failures,
            reconcileErrorCode: code,
            reconcileAfter: new Date(
              Date.now() +
                Math.min(60, 5 * 2 ** Math.min(failures - 1, 4)) * MINUTE,
            ),
          },
        });
        // No raw payload, financial data, API keys, or HTTP response in logs.
        this.logger.warn({
          message: 'Billing reconciliation will retry.',
          workspaceId: candidate.workspaceId,
          code,
        });
      }
    }
    return { checked: candidates.length, planChangesRetried };
  }
}

function reconciliationFailureCode(error: unknown): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (
      typeof response === 'object' &&
      response &&
      'code' in response &&
      typeof response.code === 'string' &&
      /^[A-Z_]{1,80}$/.test(response.code)
    )
      return response.code;
  }
  return 'PADDLE_RECONCILIATION_UNAVAILABLE';
}
