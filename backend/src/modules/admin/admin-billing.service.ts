import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingCheckoutStatus,
  BillingPlanChangeStatus,
  BillingSubscriptionStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  activeBillingSubscriptionWhere,
  hasBillingAccess,
} from '../billing/billing-access.policy';
import { paddleCheckoutEnvironment } from '../billing/paddle-billing.config';
import { entitlementsFor } from '../billing/billing-plan.config';
import { PaddleBillingService } from '../billing/paddle-billing.service';
import { AuditAction } from '../audit/audit-actions';
import {
  AuditActorType,
  auditErrorCode,
  AuditLogService,
  AuditOrigin,
  AuditResult,
} from '../audit/audit-log.service';
import {
  AdminBillingIssueFilter,
  AdminBillingQueryDto,
  AdminBillingSort,
} from './dto/admin-billing-query.dto';

const PAYMENT_ISSUE_STATUSES: BillingSubscriptionStatus[] = [
  BillingSubscriptionStatus.PAST_DUE,
  BillingSubscriptionStatus.PAUSED,
];

const OPEN_CHECKOUT_STATUSES: BillingCheckoutStatus[] = [
  BillingCheckoutStatus.CREATING,
  BillingCheckoutStatus.OPEN,
  BillingCheckoutStatus.REVIEW_REQUIRED,
];

const PENDING_PLAN_CHANGE_STATUSES: BillingPlanChangeStatus[] = [
  BillingPlanChangeStatus.PROCESSING,
  BillingPlanChangeStatus.RETRY_SCHEDULED,
  BillingPlanChangeStatus.AWAITING_WEBHOOK,
  BillingPlanChangeStatus.REVIEW_REQUIRED,
];

const billingListInclude = {
  usagePeriods: {
    orderBy: { periodStart: 'desc' },
    take: 1,
    select: {
      periodStart: true,
      periodEnd: true,
      aiQuestionUnits: true,
    },
  },
  workspace: {
    select: {
      id: true,
      name: true,
      owner: { select: { id: true, name: true, email: true, image: true } },
      billingCheckouts: {
        where: { status: { in: OPEN_CHECKOUT_STATUSES } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          plan: true,
          cycle: true,
          environment: true,
          paddleTransactionId: true,
          updatedAt: true,
        },
      },
      billingPlanChanges: {
        where: { status: { in: PENDING_PLAN_CHANGE_STATUSES } },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        select: {
          id: true,
          status: true,
          plan: true,
          cycle: true,
          environment: true,
          retryAt: true,
          failureCode: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.BillingSubscriptionInclude;

const billingDetailInclude = {
  usagePeriods: {
    orderBy: { periodStart: 'desc' },
    take: 3,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      aiQuestionUnits: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  workspace: {
    select: {
      id: true,
      name: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true, image: true } },
      billingCheckouts: {
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          requestedByUserId: true,
          environment: true,
          status: true,
          plan: true,
          cycle: true,
          paddlePriceId: true,
          paddleTransactionId: true,
          expectedPaddleCustomerId: true,
          previousPaddleSubscriptionId: true,
          paddleSubscriptionId: true,
          boundAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      billingPlanChanges: {
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          requestedByUserId: true,
          environment: true,
          status: true,
          paddleSubscriptionId: true,
          paddleCustomerId: true,
          sourcePriceId: true,
          targetPriceId: true,
          plan: true,
          cycle: true,
          expiresAt: true,
          submittedAt: true,
          retryAfterSeconds: true,
          retryAt: true,
          retryCount: true,
          completedAt: true,
          failureCode: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} satisfies Prisma.BillingSubscriptionInclude;

type BillingListRecord = Prisma.BillingSubscriptionGetPayload<{
  include: typeof billingListInclude;
}>;

type BillingDetailRecord = Prisma.BillingSubscriptionGetPayload<{
  include: typeof billingDetailInclude;
}>;

@Injectable()
export class AdminBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddle: PaddleBillingService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: AdminBillingQueryDto) {
    const where = this.buildWhere(query);
    const [
      subscriptions,
      total,
      all,
      active,
      paymentIssues,
      reconciliationIssues,
      pendingOperations,
    ] = await Promise.all([
      this.prisma.billingSubscription.findMany({
        where,
        include: billingListInclude,
        orderBy: this.resolveOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.billingSubscription.count({ where }),
      this.prisma.billingSubscription.count(),
      this.prisma.billingSubscription.count({
        where: {
          AND: [
            activeBillingSubscriptionWhere(new Date()),
            { status: BillingSubscriptionStatus.ACTIVE },
          ],
        },
      }),
      this.prisma.billingSubscription.count({
        where: { status: { in: PAYMENT_ISSUE_STATUSES } },
      }),
      this.prisma.billingSubscription.count({
        where: {
          OR: [
            { reconcileFailures: { gt: 0 } },
            { reconcileErrorCode: { not: null } },
          ],
        },
      }),
      this.prisma.billingSubscription.count({
        where: {
          OR: [
            {
              workspace: {
                billingCheckouts: {
                  some: { status: { in: OPEN_CHECKOUT_STATUSES } },
                },
              },
            },
            {
              workspace: {
                billingPlanChanges: {
                  some: { status: { in: PENDING_PLAN_CHANGE_STATUSES } },
                },
              },
            },
          ],
        },
      }),
    ]);

    return {
      items: subscriptions.map((subscription) => this.toSummary(subscription)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      summary: {
        total: all,
        active,
        paymentIssues,
        reconciliationIssues,
        pendingOperations,
      },
    };
  }

  async findOne(workspaceId: string) {
    const subscription = await this.prisma.billingSubscription.findUnique({
      where: { workspaceId },
      include: billingDetailInclude,
    });
    if (!subscription) {
      throw new NotFoundException('Çalışma alanına ait abonelik bulunamadı.');
    }
    return this.toDetail(subscription);
  }

  async reconcile(workspaceId: string, adminUserId: string) {
    const subscription = await this.prisma.billingSubscription.findUnique({
      where: { workspaceId },
      select: {
        id: true,
        plan: true,
        cycle: true,
        status: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: true,
        reconcileFailures: true,
        reconcileErrorCode: true,
        paddleSubscriptionId: true,
        workspace: {
          select: {
            billingCheckouts: {
              where: {
                environment: paddleCheckoutEnvironment(),
                status: BillingCheckoutStatus.OPEN,
                paddleTransactionId: { not: null },
                boundAt: null,
              },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    if (!subscription) {
      throw new NotFoundException('Çalışma alanına ait abonelik bulunamadı.');
    }
    if (
      !subscription.paddleSubscriptionId &&
      subscription.workspace.billingCheckouts.length === 0
    ) {
      throw new BadRequestException({
        code: 'PADDLE_REFERENCE_MISSING',
        message: 'Doğrulanabilecek Paddle aboneliği veya ödeme işlemi yok.',
      });
    }

    const auditBase = {
      actorType: AuditActorType.ADMIN,
      actorUserId: adminUserId,
      origin: AuditOrigin.API,
      action: AuditAction.ADMIN_BILLING_RECONCILE,
      workspaceId,
      targetType: 'BILLING_SUBSCRIPTION',
      targetId: subscription.id,
      before: billingAuditSnapshot(subscription),
    } as const;
    await this.audit.record({ ...auditBase, result: AuditResult.STARTED });

    try {
      await this.paddle.reconcileWorkspace(workspaceId);
      const checkedAt = new Date();
      const current = await this.prisma.billingSubscription.findUniqueOrThrow({
        where: { workspaceId },
        select: { id: true, updatedAt: true },
      });
      await this.prisma.billingSubscription.updateMany({
        where: { id: current.id, updatedAt: current.updatedAt },
        data: {
          lastReconciledAt: checkedAt,
          reconcileAfter: new Date(checkedAt.getTime() + 5 * 60_000),
          reconcileFailures: 0,
          reconcileErrorCode: null,
        },
      });
    } catch (error) {
      const code = reconciliationFailureCode(error);
      await this.prisma.billingSubscription.update({
        where: { workspaceId },
        data: {
          reconcileFailures: { increment: 1 },
          reconcileErrorCode: code,
          reconcileAfter: new Date(Date.now() + 5 * 60_000),
        },
      });
      await this.audit.recordSafely({
        ...auditBase,
        result: AuditResult.FAILURE,
        errorCode: auditErrorCode(error),
        metadata: { reconciliationCode: code },
      });
      throw error;
    }

    const result = await this.findOne(workspaceId);
    await this.audit.recordSafely({
      ...auditBase,
      result: AuditResult.SUCCESS,
      after: billingAuditSnapshot(result),
    });
    return result;
  }

  private buildWhere(
    query: AdminBillingQueryDto,
  ): Prisma.BillingSubscriptionWhereInput {
    const conditions: Prisma.BillingSubscriptionWhereInput[] = [];

    if (query.q) {
      conditions.push({
        OR: [
          { paddleCustomerId: { contains: query.q, mode: 'insensitive' } },
          { paddleSubscriptionId: { contains: query.q, mode: 'insensitive' } },
          {
            workspace: {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                {
                  owner: {
                    is: {
                      OR: [
                        { name: { contains: query.q, mode: 'insensitive' } },
                        { email: { contains: query.q, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              ],
            },
          },
        ],
      });
    }
    if (query.plan) conditions.push({ plan: query.plan });
    if (query.status) conditions.push({ status: query.status });

    if (query.issue === AdminBillingIssueFilter.PAYMENT) {
      conditions.push({ status: { in: PAYMENT_ISSUE_STATUSES } });
    } else if (query.issue === AdminBillingIssueFilter.RECONCILIATION) {
      conditions.push({
        OR: [
          { reconcileFailures: { gt: 0 } },
          { reconcileErrorCode: { not: null } },
        ],
      });
    } else if (query.issue === AdminBillingIssueFilter.CHECKOUT) {
      conditions.push({
        workspace: {
          billingCheckouts: {
            some: { status: { in: OPEN_CHECKOUT_STATUSES } },
          },
        },
      });
    } else if (query.issue === AdminBillingIssueFilter.PLAN_CHANGE) {
      conditions.push({
        workspace: {
          billingPlanChanges: {
            some: { status: { in: PENDING_PLAN_CHANGE_STATUSES } },
          },
        },
      });
    }

    return conditions.length ? { AND: conditions } : {};
  }

  private resolveOrderBy(
    sort: AdminBillingSort,
  ): Prisma.BillingSubscriptionOrderByWithRelationInput[] {
    if (sort === AdminBillingSort.PERIOD_END) {
      return [{ currentPeriodEnd: 'asc' }, { id: 'asc' }];
    }
    if (sort === AdminBillingSort.FAILURES) {
      return [{ reconcileFailures: 'desc' }, { updatedAt: 'desc' }];
    }
    return [{ updatedAt: 'desc' }, { id: 'desc' }];
  }

  private toSummary(subscription: BillingListRecord) {
    const usage = subscription.usagePeriods[0] ?? null;
    const checkout =
      subscription.workspace.billingCheckouts.find((item) =>
        OPEN_CHECKOUT_STATUSES.includes(item.status),
      ) ?? null;
    const planChange =
      subscription.workspace.billingPlanChanges.find((item) =>
        PENDING_PLAN_CHANGE_STATUSES.includes(item.status),
      ) ?? null;
    const entitlements = entitlementsFor(
      subscription.plan,
      subscription.status,
    );

    return {
      id: subscription.id,
      workspace: subscription.workspace,
      plan: subscription.plan,
      cycle: subscription.cycle,
      status: subscription.status,
      hasAccess: hasBillingAccess(subscription),
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      scheduledAccessEndsAt: subscription.scheduledAccessEndsAt,
      paddleCustomerId: subscription.paddleCustomerId,
      paddleSubscriptionId: subscription.paddleSubscriptionId,
      lastReconciledAt: subscription.lastReconciledAt,
      reconcileAfter: subscription.reconcileAfter,
      reconcileFailures: subscription.reconcileFailures,
      reconcileErrorCode: subscription.reconcileErrorCode,
      usage: usage
        ? {
            aiQuestions: usage.aiQuestionUnits,
            limit: entitlements.monthlyAiQuestions,
            periodStart: usage.periodStart,
            periodEnd: usage.periodEnd,
          }
        : null,
      pendingCheckout: checkout,
      pendingPlanChange: planChange,
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
    };
  }

  private toDetail(subscription: BillingDetailRecord) {
    const entitlements = entitlementsFor(
      subscription.plan,
      subscription.status,
    );
    return {
      ...this.toSummary(subscription),
      workspace: {
        id: subscription.workspace.id,
        name: subscription.workspace.name,
        createdAt: subscription.workspace.createdAt,
        owner: subscription.workspace.owner,
      },
      trialEndsAt: subscription.trialEndsAt,
      canceledAt: subscription.canceledAt,
      paddlePriceId: subscription.paddlePriceId,
      paddleUpdatedAt: subscription.paddleUpdatedAt,
      paddleSnapshotAt: subscription.paddleSnapshotAt,
      usagePeriodAnchor: subscription.usagePeriodAnchor,
      entitlements,
      usagePeriods: subscription.usagePeriods,
      checkouts: subscription.workspace.billingCheckouts,
      planChanges: subscription.workspace.billingPlanChanges,
    };
  }
}

function billingAuditSnapshot(subscription: {
  plan: unknown;
  cycle: unknown;
  status: unknown;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date;
  reconcileFailures: number;
  reconcileErrorCode: string | null;
}) {
  return {
    plan: subscription.plan,
    cycle: subscription.cycle,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodEnd: subscription.currentPeriodEnd,
    reconcileFailures: subscription.reconcileFailures,
    reconcileErrorCode: subscription.reconcileErrorCode,
  };
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
    ) {
      return response.code;
    }
  }
  return 'PADDLE_RECONCILIATION_UNAVAILABLE';
}
