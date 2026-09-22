import {
  BillingCycle,
  BillingSubscriptionStatus,
} from '../../generated/prisma/enums';

export type BillingUsageWindowSubscription = {
  cycle: BillingCycle;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  usagePeriodAnchor: Date | null;
};

export type BillingUsageWindow = {
  start: Date;
  end: Date;
};

export function resolveBillingUsageWindow(
  subscription: BillingUsageWindowSubscription,
  now = new Date(),
): BillingUsageWindow {
  // Do not grant a fresh monthly allowance while a paid renewal is unverified.
  // When Paddle confirms the next period, the original anchor advances normally.
  if (
    subscription.status === BillingSubscriptionStatus.ACTIVE &&
    subscription.currentPeriodEnd <= now
  ) {
    now = new Date(subscription.currentPeriodEnd.getTime() - 1);
  }
  if (
    subscription.status === BillingSubscriptionStatus.TRIALING ||
    (!subscription.usagePeriodAnchor &&
      subscription.cycle === BillingCycle.MONTHLY)
  ) {
    return {
      start: subscription.currentPeriodStart,
      end: subscription.currentPeriodEnd,
    };
  }

  const anchor =
    subscription.usagePeriodAnchor ?? subscription.currentPeriodStart;
  let monthIndex = 0;
  let nextBoundary = addUtcMonthsClamped(anchor, 1);

  while (
    nextBoundary <= now &&
    (subscription.usagePeriodAnchor ||
      nextBoundary < subscription.currentPeriodEnd)
  ) {
    monthIndex += 1;
    nextBoundary = addUtcMonthsClamped(anchor, monthIndex + 1);
  }

  return {
    start: addUtcMonthsClamped(anchor, monthIndex),
    end:
      subscription.usagePeriodAnchor ||
      nextBoundary < subscription.currentPeriodEnd
        ? nextBoundary
        : subscription.currentPeriodEnd,
  };
}

export function findBillingUsagePeriodForWindow<
  T extends { periodStart: Date },
>(periods: readonly T[], window: BillingUsageWindow): T | null {
  const startTime = window.start.getTime();
  return (
    periods.find((period) => period.periodStart.getTime() === startTime) ?? null
  );
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
