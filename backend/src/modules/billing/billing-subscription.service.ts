import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingCycle,
  BillingPlan,
  BillingSubscriptionStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_TRIAL_DAYS } from './billing-plan.config';
import { hasBillingAccess } from './billing-access.policy';
import { BillingAccessRequiredException } from './billing.errors';
import { resolveBillingUsageWindow } from './billing-usage-window';

type SubscriptionRecord = Prisma.BillingSubscriptionGetPayload<object>;
type BillingSubscriptionClient = Pick<
  Prisma.TransactionClient,
  'billingSubscription'
>;

@Injectable()
export class BillingSubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForWorkspace(
    workspaceId: string,
    now = new Date(),
    client: BillingSubscriptionClient = this.prisma,
  ): Promise<SubscriptionRecord> {
    const trialEndsAt = addUtcDays(now, BILLING_TRIAL_DAYS);
    let subscription = await client.billingSubscription.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        plan: BillingPlan.STARTER,
        cycle: BillingCycle.MONTHLY,
        status: BillingSubscriptionStatus.TRIALING,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
      },
      update: {},
    });

    if (
      subscription.status === BillingSubscriptionStatus.TRIALING &&
      !subscription.paddleSubscriptionId &&
      (!subscription.trialEndsAt || subscription.trialEndsAt <= now)
    ) {
      // A webhook may bind/activate this subscription after the initial read.
      // Expire only an unchanged local trial; Paddle owns its own lifecycle.
      await client.billingSubscription.updateMany({
        where: {
          id: subscription.id,
          updatedAt: subscription.updatedAt,
          status: BillingSubscriptionStatus.TRIALING,
          paddleSubscriptionId: null,
          OR: [{ trialEndsAt: null }, { trialEndsAt: { lte: now } }],
        },
        data: { status: BillingSubscriptionStatus.EXPIRED },
      });
      subscription = await client.billingSubscription.findUniqueOrThrow({
        where: { id: subscription.id },
      });
    }

    return subscription;
  }

  hasAccess(subscription: SubscriptionRecord, now = new Date()) {
    return hasBillingAccess(subscription, now);
  }

  async hasStoreAccess(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        workspace: {
          select: {
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
    });
    // Evaluate the time after the DB read, not when the async check started.
    return hasBillingAccess(store?.workspace.billingSubscription);
  }

  async assertStoreAccess(storeId: string, message?: string) {
    if (!(await this.hasStoreAccess(storeId)))
      throw new BillingAccessRequiredException(message);
  }

  resolveUsageWindow(subscription: SubscriptionRecord, now = new Date()) {
    return resolveBillingUsageWindow(subscription, now);
  }
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
