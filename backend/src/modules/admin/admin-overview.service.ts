import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  AuditActorType,
  AuditResult,
  BillingSubscriptionStatus,
  BillingUsageMetric,
  CatalogSyncKind,
  CatalogSyncStatus,
  StoreStatus,
  SupportTicketPriority,
  SupportTicketStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { PRODUCT_SYNC_LOCK_TIMEOUT_MS } from '../product-sync/product-sync.constants';
import { QUESTION_SYNC_LOCK_TIMEOUT_MS } from '../question-sync/question-sync.constants';

const DAY = 24 * 60 * 60 * 1000;
const OPEN_SUPPORT_STATUSES = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.WAITING_CUSTOMER,
];

@Injectable()
export class AdminOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getHeaderSummary() {
    const [openSupportTickets, paymentIssues, activeSyncs] = await Promise.all([
      this.prisma.supportTicket.count({
        where: { status: { in: OPEN_SUPPORT_STATUSES } },
      }),
      this.prisma.billingSubscription.count({
        where: { status: BillingSubscriptionStatus.PAST_DUE },
      }),
      this.prisma.catalogSyncRun.count({
        where: { status: CatalogSyncStatus.RUNNING },
      }),
    ]);

    return {
      openSupportTickets,
      paymentIssues,
      activeSyncs,
      checkedAt: new Date().toISOString(),
    };
  }

  async getOverview() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - DAY);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * DAY);
    const staleSyncWhere = this.staleSyncWhere(now);

    const [
      totalUsers,
      newUsers,
      totalWorkspaces,
      newWorkspaces,
      activeStores,
      subscriptionGroups,
      currentAiUsage,
      previousAiUsage,
      openSupportTickets,
      urgentSupportTickets,
      overdueSupportTickets,
      runningSyncs,
      failedSyncsLastDay,
      staleSyncs,
      auditFailuresLastDay,
      paymentIssues,
      priorityTickets,
      recentFailedSyncs,
      recentAuditEvents,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.workspace.count(),
      this.prisma.workspace.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.store.count({ where: { status: StoreStatus.ACTIVE } }),
      this.prisma.billingSubscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.billingUsageEvent.aggregate({
        where: {
          metric: BillingUsageMetric.AI_QUESTION,
          createdAt: { gte: thirtyDaysAgo, lte: now },
        },
        _sum: { quantity: true },
      }),
      this.prisma.billingUsageEvent.aggregate({
        where: {
          metric: BillingUsageMetric.AI_QUESTION,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        },
        _sum: { quantity: true },
      }),
      this.prisma.supportTicket.count({
        where: { status: { in: OPEN_SUPPORT_STATUSES } },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: { in: OPEN_SUPPORT_STATUSES },
          priority: {
            in: [SupportTicketPriority.HIGH, SupportTicketPriority.URGENT],
          },
        },
      }),
      this.prisma.supportTicket.count({
        where: {
          status: { in: OPEN_SUPPORT_STATUSES },
          firstRespondedAt: null,
          firstResponseDueAt: { lt: now },
        },
      }),
      this.prisma.catalogSyncRun.count({
        where: { status: CatalogSyncStatus.RUNNING },
      }),
      this.prisma.catalogSyncRun.count({
        where: {
          status: CatalogSyncStatus.FAILED,
          startedAt: { gte: dayAgo },
        },
      }),
      this.prisma.catalogSyncRun.count({ where: staleSyncWhere }),
      this.prisma.auditLog.count({
        where: { result: AuditResult.FAILURE, createdAt: { gte: dayAgo } },
      }),
      this.prisma.billingSubscription.findMany({
        where: { status: BillingSubscriptionStatus.PAST_DUE },
        select: {
          workspaceId: true,
          plan: true,
          currentPeriodEnd: true,
          reconcileFailures: true,
          reconcileErrorCode: true,
          workspace: {
            select: {
              name: true,
              owner: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: [{ reconcileFailures: 'desc' }, { currentPeriodEnd: 'asc' }],
        take: 4,
      }),
      this.prisma.supportTicket.findMany({
        where: { status: { in: OPEN_SUPPORT_STATUSES } },
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          priority: true,
          firstResponseDueAt: true,
          firstRespondedAt: true,
          lastMessageAt: true,
          workspace: { select: { id: true, name: true } },
        },
        orderBy: [
          { priority: 'desc' },
          { firstResponseDueAt: 'asc' },
          { lastMessageAt: 'desc' },
        ],
        take: 5,
      }),
      this.prisma.catalogSyncRun.findMany({
        where: {
          status: CatalogSyncStatus.FAILED,
          startedAt: { gte: dayAgo },
        },
        select: {
          id: true,
          kind: true,
          errorMessage: true,
          completedAt: true,
          connection: {
            select: {
              providerKey: true,
              store: {
                select: {
                  id: true,
                  name: true,
                  workspace: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
        take: 4,
      }),
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { result: AuditResult.FAILURE },
            { actorType: AuditActorType.ADMIN },
            {
              action: {
                in: [
                  'ACCOUNT_DELETED',
                  'ACCOUNT_BILLING_CLOSED',
                  'BILLING_PLAN_CHANGE_CONFIRMED',
                  'BILLING_SUBSCRIPTION_SYNCHRONIZED',
                ],
              },
            },
          ],
        },
        select: {
          id: true,
          actorType: true,
          actorUserId: true,
          origin: true,
          action: true,
          result: true,
          workspaceId: true,
          targetType: true,
          targetId: true,
          errorCode: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 6,
      }),
    ]);

    const subscriptionCounts = new Map(
      subscriptionGroups.map((group) => [group.status, group._count._all]),
    );
    const currentAiUnits = currentAiUsage._sum.quantity ?? 0;
    const previousAiUnits = previousAiUsage._sum.quantity ?? 0;
    const auditContext = await this.resolveAuditContext(recentAuditEvents);

    return {
      metrics: {
        customers: {
          totalUsers,
          newUsersLast30Days: newUsers,
          totalWorkspaces,
          newWorkspacesLast30Days: newWorkspaces,
          activeStores,
        },
        subscriptions: {
          total: sum(subscriptionCounts.values()),
          trialing:
            subscriptionCounts.get(BillingSubscriptionStatus.TRIALING) ?? 0,
          active: subscriptionCounts.get(BillingSubscriptionStatus.ACTIVE) ?? 0,
          pastDue:
            subscriptionCounts.get(BillingSubscriptionStatus.PAST_DUE) ?? 0,
          paused: subscriptionCounts.get(BillingSubscriptionStatus.PAUSED) ?? 0,
          canceled:
            subscriptionCounts.get(BillingSubscriptionStatus.CANCELED) ?? 0,
          expired:
            subscriptionCounts.get(BillingSubscriptionStatus.EXPIRED) ?? 0,
        },
        aiUsage: {
          last30Days: currentAiUnits,
          previous30Days: previousAiUnits,
          changePercentage: percentageChange(currentAiUnits, previousAiUnits),
        },
        support: {
          open: openSupportTickets,
          highPriority: urgentSupportTickets,
          overdueFirstResponse: overdueSupportTickets,
        },
        operations: {
          running: runningSyncs,
          failedLast24Hours: failedSyncsLastDay,
          stale: staleSyncs,
        },
        audit: { failuresLast24Hours: auditFailuresLastDay },
      },
      attention: {
        paymentIssues: paymentIssues.map((subscription) => ({
          workspaceId: subscription.workspaceId,
          workspaceName: subscription.workspace.name,
          ownerName: subscription.workspace.owner.name,
          ownerEmail: subscription.workspace.owner.email,
          plan: subscription.plan,
          currentPeriodEnd: subscription.currentPeriodEnd,
          reconcileFailures: subscription.reconcileFailures,
          reconcileErrorCode: subscription.reconcileErrorCode,
        })),
        supportTickets: priorityTickets.map((ticket) => ({
          ...ticket,
          isFirstResponseOverdue:
            !ticket.firstRespondedAt && ticket.firstResponseDueAt < now,
        })),
        failedSyncs: recentFailedSyncs.map((run) => ({
          id: run.id,
          kind: run.kind,
          providerKey: run.connection.providerKey,
          store: run.connection.store,
          errorMessage: run.errorMessage,
          completedAt: run.completedAt,
        })),
      },
      recentAuditEvents: recentAuditEvents.map((event) => ({
        ...event,
        actor: event.actorUserId
          ? (auditContext.actors.get(event.actorUserId) ?? null)
          : null,
        workspace: event.workspaceId
          ? (auditContext.workspaces.get(event.workspaceId) ?? null)
          : null,
      })),
      generatedAt: now,
    };
  }

  private staleSyncWhere(now: Date): Prisma.CatalogSyncRunWhereInput {
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

  private async resolveAuditContext(
    events: Array<{ actorUserId: string | null; workspaceId: string | null }>,
  ) {
    const actorIds = unique(events.map((event) => event.actorUserId));
    const workspaceIds = unique(events.map((event) => event.workspaceId));
    const actorQuery: Promise<
      Array<{ id: string; name: string; email: string }>
    > = actorIds.length
      ? this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]);
    const workspaceQuery: Promise<Array<{ id: string; name: string }>> =
      workspaceIds.length
        ? this.prisma.workspace.findMany({
            where: { id: { in: workspaceIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]);
    const [actors, workspaces] = await Promise.all([
      actorQuery,
      workspaceQuery,
    ]);

    return {
      actors: new Map(actors.map((actor) => [actor.id, actor] as const)),
      workspaces: new Map(
        workspaces.map((workspace) => [workspace.id, workspace] as const),
      ),
    };
  }
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function sum(values: Iterable<number>) {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function unique(values: Array<string | null>) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}
