import type { Prisma } from '../../generated/prisma/client';
import { BillingSubscriptionStatus } from '../../generated/prisma/enums';

export type SubscriptionAccessState = {
  status: BillingSubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date;
  paddleSubscriptionId?: string | null;
  cancelAtPeriodEnd?: boolean;
  scheduledAccessEndsAt?: Date | null;
};

export const BILLING_RENEWAL_GRACE_MS = 30 * 60_000;

// A fixed window, never extended by retries, refreshes, or API outages.
// Known failed payments, trials, cancellations and scheduled pauses get no grace.
export function renewalGraceEndsAt(subscription: SubscriptionAccessState) {
  if (
    subscription.status !== BillingSubscriptionStatus.ACTIVE ||
    !subscription.paddleSubscriptionId ||
    subscription.cancelAtPeriodEnd ||
    subscription.scheduledAccessEndsAt
  )
    return null;
  return new Date(
    subscription.currentPeriodEnd.getTime() + BILLING_RENEWAL_GRACE_MS,
  );
}

export function isAwaitingRenewal(
  subscription: SubscriptionAccessState,
  now = new Date(),
) {
  const graceEnd = renewalGraceEndsAt(subscription);
  return Boolean(
    graceEnd && subscription.currentPeriodEnd <= now && graceEnd > now,
  );
}

// Access and AI quota are separate: already prepared answers and sync do not
// consume AI units. A scheduled cancellation keeps access until period end.
export function hasBillingAccess(
  subscription: SubscriptionAccessState | null | undefined,
  now = new Date(),
) {
  if (!subscription) return false;
  if (
    subscription.scheduledAccessEndsAt &&
    subscription.scheduledAccessEndsAt <= now
  )
    return false;
  if (subscription.status === BillingSubscriptionStatus.TRIALING)
    return Boolean(subscription.trialEndsAt && subscription.trialEndsAt > now);
  return (
    subscription.status === BillingSubscriptionStatus.ACTIVE &&
    (subscription.currentPeriodEnd > now ||
      isAwaitingRenewal(subscription, now))
  );
}

// SQL counterpart of hasBillingAccess. Missing subscriptions fail closed;
// schedulers must not create or restart trials as a side effect.
export function activeBillingSubscriptionWhere(
  now = new Date(),
): Prisma.BillingSubscriptionWhereInput {
  return {
    AND: [
      {
        OR: [
          { scheduledAccessEndsAt: null },
          { scheduledAccessEndsAt: { gt: now } },
        ],
      },
    ],
    OR: [
      { status: BillingSubscriptionStatus.TRIALING, trialEndsAt: { gt: now } },
      {
        status: BillingSubscriptionStatus.ACTIVE,
        currentPeriodEnd: { gt: now },
      },
      {
        status: BillingSubscriptionStatus.ACTIVE,
        paddleSubscriptionId: { not: null },
        cancelAtPeriodEnd: false,
        scheduledAccessEndsAt: null,
        currentPeriodEnd: {
          gt: new Date(now.getTime() - BILLING_RENEWAL_GRACE_MS),
        },
      },
    ],
  };
}

export const BILLING_SYNC_STOPPED_MESSAGE =
  'Abonelik erişimi aktif olmadığı için senkronizasyon durduruldu. Kayıtlı veriler korunur; mevcut soruları manuel yanıtlayabilirsiniz.';
export const BILLING_AUTOMATION_STOPPED_MESSAGE =
  'Abonelik erişimi aktif olmadığı için otomatik gönderim durduruldu. Hazırlanan cevabı inceleyerek manuel gönderebilirsiniz.';
