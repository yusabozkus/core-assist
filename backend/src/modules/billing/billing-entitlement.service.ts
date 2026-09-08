import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import {
  BillingAccessRequiredException,
  BillingPlanLimitException,
} from './billing.errors';
import { entitlementsFor } from './billing-plan.config';
import { BillingSubscriptionService } from './billing-subscription.service';
import { BillingUsageService } from './billing-usage.service';

@Injectable()
export class BillingEntitlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: BillingSubscriptionService,
    private readonly usage: BillingUsageService,
  ) {}

  async getSummaryForStore(storeId: string, userId: string) {
    const store = await this.prisma.store.findFirst({
      where: {
        id: storeId,
        OR: [
          { members: { some: { userId } } },
          { workspace: { members: { some: { userId } } } },
        ],
      },
      select: { workspaceId: true },
    });
    if (!store) {
      throw new NotFoundException('Mağaza bulunamadı veya erişiminiz yok.');
    }

    return this.getSummaryForWorkspace(store.workspaceId);
  }

  async getSummaryForWorkspace(workspaceId: string, now = new Date()) {
    const subscription = await this.subscriptions.getOrCreateForWorkspace(
      workspaceId,
      now,
    );
    const limits = entitlementsFor(subscription.plan, subscription.status);
    const [questionUsage, stores, members, activeProducts] = await Promise.all([
      this.usage.getCurrentForWorkspace(workspaceId, now),
      this.prisma.store.count({
        where: { workspaceId, status: 'ACTIVE' },
      }),
      this.prisma.workspaceMember.count({ where: { workspaceId } }),
      this.prisma.product.count({
        where: {
          store: { workspaceId },
          status: ProductStatus.ACTIVE,
        },
      }),
    ]);

    return {
      subscription: {
        id: subscription.id,
        plan: subscription.plan,
        cycle: subscription.cycle,
        status: subscription.status,
        active: this.subscriptions.hasAccess(subscription, now),
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
      entitlements: {
        ...limits,
        aiDrafts: true,
        safeAutoSend: true,
        aiPerformance: true,
      },
      usage: {
        questions: questionUsage,
        stores: capacityUsage(stores, limits.stores),
        members: capacityUsage(members, limits.members),
        activeProducts: capacityUsage(activeProducts, limits.activeProducts),
      },
    };
  }

  async assertStoreCapacity(workspaceId: string) {
    const summary = await this.getSummaryForWorkspace(workspaceId);
    if (!summary.subscription.active) {
      throw new BillingAccessRequiredException();
    }
    if (summary.usage.stores.remaining < 1) {
      throw new BillingPlanLimitException(
        'stores',
        summary.entitlements.stores,
      );
    }
  }

  async assertMemberCapacity(workspaceId: string) {
    const summary = await this.getSummaryForWorkspace(workspaceId);
    if (!summary.subscription.active) {
      throw new BillingAccessRequiredException();
    }
    if (summary.usage.members.remaining < 1) {
      throw new BillingPlanLimitException(
        'members',
        summary.entitlements.members,
      );
    }
  }

  async assertProductCapacity(workspaceId: string, additionalProducts = 1) {
    const summary = await this.getSummaryForWorkspace(workspaceId);
    if (!summary.subscription.active) {
      throw new BillingAccessRequiredException();
    }
    if (summary.usage.activeProducts.remaining < additionalProducts) {
      throw new BillingPlanLimitException(
        'activeProducts',
        summary.entitlements.activeProducts,
      );
    }
  }
}

function capacityUsage(used: number, limit: number) {
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percentage: limit === 0 ? 100 : Math.min(100, (used / limit) * 100),
  };
}
