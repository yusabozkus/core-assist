import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
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
    return this.prisma.$transaction((transaction) =>
      this.assertStoreCapacityInTransaction(transaction, workspaceId),
    );
  }

  async assertStoreCapacityInTransaction(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const limits = await this.getActiveLimitsInTransaction(
      transaction,
      workspaceId,
    );
    const stores = await transaction.store.count({
      where: { workspaceId, status: 'ACTIVE' },
    });
    if (stores >= limits.stores) {
      throw new BillingPlanLimitException('stores', limits.stores);
    }
  }

  async assertMemberCapacity(workspaceId: string) {
    return this.prisma.$transaction((transaction) =>
      this.assertMemberCapacityInTransaction(transaction, workspaceId),
    );
  }

  async assertMemberCapacityInTransaction(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
  ) {
    const limits = await this.getActiveLimitsInTransaction(
      transaction,
      workspaceId,
    );
    const members = await transaction.workspaceMember.count({
      where: { workspaceId },
    });
    if (members >= limits.members) {
      throw new BillingPlanLimitException('members', limits.members);
    }
  }

  async assertProductCapacity(workspaceId: string, additionalProducts = 1) {
    return this.prisma.$transaction((transaction) =>
      this.assertProductCapacityInTransaction(
        transaction,
        workspaceId,
        additionalProducts,
      ),
    );
  }

  async assertProductCapacityForStoreInTransaction(
    transaction: Prisma.TransactionClient,
    storeId: string,
    additionalProducts = 1,
  ) {
    const store = await transaction.store.findUnique({
      where: { id: storeId },
      select: { workspaceId: true },
    });
    if (!store) throw new NotFoundException('Mağaza bulunamadı.');

    return this.assertProductCapacityInTransaction(
      transaction,
      store.workspaceId,
      additionalProducts,
    );
  }

  async assertProductCapacityInTransaction(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    additionalProducts = 1,
  ) {
    const limits = await this.getActiveLimitsInTransaction(
      transaction,
      workspaceId,
    );
    const activeProducts = await transaction.product.count({
      where: {
        store: { workspaceId },
        status: ProductStatus.ACTIVE,
      },
    });
    if (activeProducts + additionalProducts > limits.activeProducts) {
      throw new BillingPlanLimitException(
        'activeProducts',
        limits.activeProducts,
      );
    }
  }

  private async getActiveLimitsInTransaction(
    transaction: Prisma.TransactionClient,
    workspaceId: string,
    now = new Date(),
  ) {
    await transaction.$queryRaw`
      SELECT "id"
      FROM "workspace"
      WHERE "id" = ${workspaceId}
      FOR UPDATE
    `;

    const subscription = await this.subscriptions.getOrCreateForWorkspace(
      workspaceId,
      now,
      transaction,
    );
    if (!this.subscriptions.hasAccess(subscription, now)) {
      throw new BillingAccessRequiredException();
    }

    return entitlementsFor(subscription.plan, subscription.status);
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
