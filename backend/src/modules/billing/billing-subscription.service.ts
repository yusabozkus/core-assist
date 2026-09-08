import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import {
  BillingCycle,
  BillingPlan,
  BillingSubscriptionStatus,
} from '../../generated/prisma/enums';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_TRIAL_DAYS } from './billing-plan.config';

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
      (!subscription.trialEndsAt || subscription.trialEndsAt <= now)
    ) {
      subscription = await client.billingSubscription.update({
        where: { id: subscription.id },
        data: { status: BillingSubscriptionStatus.EXPIRED },
      });
    }

    return subscription;
  }

  hasAccess(subscription: SubscriptionRecord, now = new Date()) {
    if (subscription.status === BillingSubscriptionStatus.TRIALING) {
      return Boolean(
        subscription.trialEndsAt && subscription.trialEndsAt > now,
      );
    }

    return (
      subscription.status === BillingSubscriptionStatus.ACTIVE &&
      subscription.currentPeriodEnd > now
    );
  }

  resolveUsageWindow(subscription: SubscriptionRecord, now = new Date()) {
    if (
      subscription.status === BillingSubscriptionStatus.TRIALING ||
      subscription.cycle === BillingCycle.MONTHLY
    ) {
      return {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
      };
    }

    const anchor = subscription.currentPeriodStart;
    let monthIndex = 0;
    let nextBoundary = addUtcMonthsClamped(anchor, 1);

    while (
      nextBoundary <= now &&
      nextBoundary < subscription.currentPeriodEnd
    ) {
      monthIndex += 1;
      nextBoundary = addUtcMonthsClamped(anchor, monthIndex + 1);
    }

    return {
      start: addUtcMonthsClamped(anchor, monthIndex),
      end:
        nextBoundary < subscription.currentPeriodEnd
          ? nextBoundary
          : subscription.currentPeriodEnd,
    };
  }
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addUtcMonthsClamped(date: Date, months: number) {
  const targetMonth = date.getUTCMonth() + months;
  const firstOfTarget = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      targetMonth,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(
      firstOfTarget.getUTCFullYear(),
      firstOfTarget.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return firstOfTarget;
}
