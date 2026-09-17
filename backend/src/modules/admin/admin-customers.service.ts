import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingSubscriptionStatus,
  ProductStatus,
  SupportTicketStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  entitlementsFor,
  type BillingEntitlements,
} from '../billing/billing-plan.config';
import {
  activeBillingSubscriptionWhere,
  hasBillingAccess,
} from '../billing/billing-access.policy';
import {
  AdminCustomerOnboardingFilter,
  AdminCustomerSort,
  AdminCustomersQueryDto,
  AdminCustomerSubscriptionFilter,
} from './dto/admin-customers-query.dto';

const ACTIVE_TICKET_STATUSES: SupportTicketStatus[] = [
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.WAITING_CUSTOMER,
];

const customerPersonSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  onboardingCompletedAt: true,
  createdAt: true,
  sessions: {
    orderBy: { updatedAt: 'desc' },
    take: 1,
    select: { updatedAt: true },
  },
} satisfies Prisma.UserSelect;

const customerSubscriptionInclude = {
  usagePeriods: {
    orderBy: { periodStart: 'desc' },
    take: 1,
    select: {
      periodStart: true,
      periodEnd: true,
      aiQuestionUnits: true,
    },
  },
} satisfies Prisma.BillingSubscriptionInclude;

const customerListInclude = {
  owner: { select: customerPersonSelect },
  billingSubscription: { include: customerSubscriptionInclude },
  stores: { select: { id: true, status: true } },
  _count: {
    select: {
      members: true,
      stores: true,
      supportTickets: {
        where: { status: { in: ACTIVE_TICKET_STATUSES } },
      },
    },
  },
} satisfies Prisma.WorkspaceInclude;

const customerDetailInclude = {
  owner: {
    select: {
      ...customerPersonSelect,
      accounts: {
        orderBy: { createdAt: 'asc' },
        select: { providerId: true, createdAt: true },
      },
    },
  },
  members: {
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: {
        select: {
          ...customerPersonSelect,
          accounts: { select: { providerId: true } },
        },
      },
    },
  },
  invitations: {
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
    },
  },
  stores: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      status: true,
      inventoryPolicy: true,
      createdAt: true,
      updatedAt: true,
      channelConnections: {
        where: { removedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          providerKey: true,
          environment: true,
          status: true,
          connectedAt: true,
          lastSyncAt: true,
          lastInventorySyncAt: true,
          lastQuestionSyncAt: true,
          failureReason: true,
          questionSyncFailureReason: true,
        },
      },
      _count: {
        select: {
          products: true,
          productQuestions: true,
          supportTickets: true,
        },
      },
    },
  },
  billingSubscription: { include: customerSubscriptionInclude },
  supportTickets: {
    orderBy: { updatedAt: 'desc' },
    take: 6,
    select: {
      id: true,
      number: true,
      subject: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  },
  _count: {
    select: {
      members: true,
      stores: true,
      supportTickets: {
        where: { status: { in: ACTIVE_TICKET_STATUSES } },
      },
    },
  },
} satisfies Prisma.WorkspaceInclude;

const recentSyncRunSelect = {
  id: true,
  kind: true,
  status: true,
  stage: true,
  trigger: true,
  progress: true,
  productsProcessed: true,
  questionsProcessed: true,
  errorMessage: true,
  startedAt: true,
  completedAt: true,
  connection: {
    select: {
      providerKey: true,
      store: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.CatalogSyncRunSelect;

type CustomerListRecord = Prisma.WorkspaceGetPayload<{
  include: typeof customerListInclude;
}>;

type CustomerDetailRecord = Prisma.WorkspaceGetPayload<{
  include: typeof customerDetailInclude;
}>;

type RecentSyncRunRecord = Prisma.CatalogSyncRunGetPayload<{
  select: typeof recentSyncRunSelect;
}>;

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdminCustomersQueryDto) {
    const where = this.buildWhere(query);
    const now = new Date();
    const paymentIssueStatuses: BillingSubscriptionStatus[] = [
      BillingSubscriptionStatus.PAST_DUE,
      BillingSubscriptionStatus.PAUSED,
    ];

    const [workspaces, total, all, active, trialing, paymentIssues, pending] =
      await Promise.all([
        this.prisma.workspace.findMany({
          where,
          include: customerListInclude,
          orderBy: this.resolveOrderBy(query.sort),
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.workspace.count({ where }),
        this.prisma.workspace.count(),
        this.prisma.workspace.count({
          where: {
            billingSubscription: {
              is: {
                AND: [
                  activeBillingSubscriptionWhere(now),
                  { status: BillingSubscriptionStatus.ACTIVE },
                ],
              },
            },
          },
        }),
        this.prisma.workspace.count({
          where: {
            billingSubscription: {
              is: { status: BillingSubscriptionStatus.TRIALING },
            },
          },
        }),
        this.prisma.workspace.count({
          where: {
            billingSubscription: {
              is: { status: { in: paymentIssueStatuses } },
            },
          },
        }),
        this.prisma.workspace.count({
          where: { owner: { is: { onboardingCompletedAt: null } } },
        }),
      ]);

    const productCounts = await this.activeProductCounts(workspaces);

    return {
      items: workspaces.map((workspace) =>
        this.toSummary(workspace, productCounts.get(workspace.id) ?? 0),
      ),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
      summary: { total: all, active, trialing, paymentIssues, pending },
    };
  }

  async findOne(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: customerDetailInclude,
    });
    if (!workspace) throw new NotFoundException('Müşteri hesabı bulunamadı.');

    const [activeProducts, questionGroups, syncRuns] = await Promise.all([
      this.prisma.product.count({
        where: { store: { workspaceId }, status: ProductStatus.ACTIVE },
      }),
      this.prisma.productQuestion.groupBy({
        by: ['status'],
        where: { store: { workspaceId } },
        _count: { _all: true },
      }),
      this.prisma.catalogSyncRun.findMany({
        where: { connection: { store: { workspaceId } } },
        orderBy: { startedAt: 'desc' },
        take: 8,
        select: recentSyncRunSelect,
      }),
    ]);

    const questions = Object.fromEntries(
      questionGroups.map((group) => [group.status, group._count._all]),
    );

    return this.toDetail(workspace, activeProducts, questions, syncRuns);
  }

  private buildWhere(
    query: AdminCustomersQueryDto,
  ): Prisma.WorkspaceWhereInput {
    const conditions: Prisma.WorkspaceWhereInput[] = [];

    if (query.q) {
      conditions.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' as const } },
          {
            owner: {
              is: {
                OR: [
                  {
                    name: {
                      contains: query.q,
                      mode: 'insensitive' as const,
                    },
                  },
                  {
                    email: {
                      contains: query.q,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            },
          },
          {
            stores: {
              some: {
                name: { contains: query.q, mode: 'insensitive' as const },
              },
            },
          },
        ],
      });
    }

    if (query.subscription === AdminCustomerSubscriptionFilter.NONE) {
      conditions.push({ billingSubscription: { is: null } });
    } else if (query.subscription || query.plan) {
      conditions.push({
        billingSubscription: {
          is: {
            ...(query.subscription
              ? {
                  status: query.subscription as BillingSubscriptionStatus,
                }
              : {}),
            ...(query.plan ? { plan: query.plan } : {}),
          },
        },
      });
    }

    if (query.onboarding === AdminCustomerOnboardingFilter.COMPLETED) {
      conditions.push({
        owner: { is: { onboardingCompletedAt: { not: null } } },
      });
    } else if (query.onboarding === AdminCustomerOnboardingFilter.PENDING) {
      conditions.push({ owner: { is: { onboardingCompletedAt: null } } });
    }

    return conditions.length ? { AND: conditions } : {};
  }

  private resolveOrderBy(
    sort: AdminCustomerSort,
  ): Prisma.WorkspaceOrderByWithRelationInput[] {
    if (sort === AdminCustomerSort.OLDEST) {
      return [{ createdAt: 'asc' }, { id: 'asc' }];
    }
    if (sort === AdminCustomerSort.NAME) {
      return [{ name: 'asc' }, { id: 'asc' }];
    }
    return [{ createdAt: 'desc' }, { id: 'desc' }];
  }

  private async activeProductCounts(workspaces: CustomerListRecord[]) {
    const storeToWorkspace = new Map<string, string>();
    for (const workspace of workspaces) {
      for (const store of workspace.stores) {
        storeToWorkspace.set(store.id, workspace.id);
      }
    }

    const storeIds = [...storeToWorkspace.keys()];
    const result = new Map<string, number>();
    if (!storeIds.length) return result;

    const groups = await this.prisma.product.groupBy({
      by: ['storeId'],
      where: { storeId: { in: storeIds }, status: ProductStatus.ACTIVE },
      _count: { _all: true },
    });
    for (const group of groups) {
      const workspaceId = storeToWorkspace.get(group.storeId);
      if (!workspaceId) continue;
      result.set(
        workspaceId,
        (result.get(workspaceId) ?? 0) + group._count._all,
      );
    }
    return result;
  }

  private toSummary(workspace: CustomerListRecord, activeProducts: number) {
    const subscription = workspace.billingSubscription;
    const usage = subscription?.usagePeriods[0] ?? null;
    const limits = subscription
      ? entitlementsFor(subscription.plan, subscription.status)
      : null;

    return {
      id: workspace.id,
      name: workspace.name,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      owner: toPerson(workspace.owner),
      onboardingCompleted: Boolean(workspace.owner.onboardingCompletedAt),
      lastActiveAt: workspace.owner.sessions[0]?.updatedAt ?? null,
      subscription: subscription
        ? {
            plan: subscription.plan,
            cycle: subscription.cycle,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            trialEndsAt: subscription.trialEndsAt,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            scheduledAccessEndsAt: subscription.scheduledAccessEndsAt,
            hasAccess: hasBillingAccess(subscription),
          }
        : null,
      usage: usage
        ? {
            aiQuestions: usage.aiQuestionUnits,
            periodStart: usage.periodStart,
            periodEnd: usage.periodEnd,
          }
        : null,
      limits: limits ? publicLimits(limits) : null,
      counts: {
        members: workspace._count.members,
        stores: workspace._count.stores,
        activeStores: workspace.stores.filter(
          (store) => store.status === 'ACTIVE',
        ).length,
        activeProducts,
        openSupportTickets: workspace._count.supportTickets,
      },
    };
  }

  private toDetail(
    workspace: CustomerDetailRecord,
    activeProducts: number,
    questions: Record<string, number>,
    syncRuns: RecentSyncRunRecord[],
  ) {
    const summary = this.toSummary(
      {
        ...workspace,
        stores: workspace.stores.map((store) => ({
          id: store.id,
          status: store.status,
        })),
        _count: {
          ...workspace._count,
        },
      },
      activeProducts,
    );

    return {
      ...summary,
      owner: {
        ...summary.owner,
        providers: uniqueStrings(
          workspace.owner.accounts.map((account) => account.providerId),
        ),
      },
      members: workspace.members.map((member) => ({
        id: member.id,
        role: member.role,
        joinedAt: member.createdAt,
        user: {
          ...toPerson(member.user),
          providers: uniqueStrings(
            member.user.accounts.map((account) => account.providerId),
          ),
          lastActiveAt: member.user.sessions[0]?.updatedAt ?? null,
        },
      })),
      pendingInvitations: workspace.invitations,
      stores: workspace.stores.map((store) => ({
        ...store,
        channels: store.channelConnections,
        channelConnections: undefined,
        counts: {
          products: store._count.products,
          questions: store._count.productQuestions,
          supportTickets: store._count.supportTickets,
        },
        _count: undefined,
      })),
      questionCounts: {
        total: Object.values(questions).reduce((sum, value) => sum + value, 0),
        pending: questions.PENDING ?? 0,
        drafted: questions.DRAFTED ?? 0,
        answered: questions.ANSWERED ?? 0,
        ignored: questions.IGNORED ?? 0,
      },
      recentSupportTickets: workspace.supportTickets.map((ticket) => ({
        id: ticket.id,
        number: ticket.number,
        code: formatTicketCode(ticket.number, ticket.createdAt),
        subject: ticket.subject,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        messageCount: ticket._count.messages,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      })),
      recentSyncRuns: syncRuns,
    };
  }
}

function toPerson(person: {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  onboardingCompletedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    emailVerified: person.emailVerified,
    image: person.image,
    onboardingCompletedAt: person.onboardingCompletedAt,
    createdAt: person.createdAt,
  };
}

function publicLimits(limits: BillingEntitlements) {
  return {
    aiQuestions: limits.monthlyAiQuestions,
    stores: limits.stores,
    members: limits.members,
    activeProducts: limits.activeProducts,
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function formatTicketCode(number: number, createdAt: Date) {
  return `CA-${createdAt.getUTCFullYear()}-${String(number).padStart(6, '0')}`;
}
