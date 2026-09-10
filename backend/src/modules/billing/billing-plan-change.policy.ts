import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type {
  Subscription,
  SubscriptionPreview,
} from '@paddle/paddle-node-sdk';
import {
  BillingCycle,
  BillingPlan,
  BillingPlanChangeStatus,
} from '../../generated/prisma/enums';

const PLAN_RANK: Readonly<Record<BillingPlan, number>> = {
  [BillingPlan.STARTER]: 0,
  [BillingPlan.GROWTH]: 1,
  [BillingPlan.BUSINESS]: 2,
};

export type PlanChangePolicy = {
  changeType: 'upgrade' | 'downgrade' | 'billing_cycle_change';
  settlementTiming: 'immediately' | 'next_billing_period';
  prorationBillingMode: 'prorated_immediately' | 'prorated_next_billing_period';
};

export const PENDING_PLAN_CHANGE_STATUSES: BillingPlanChangeStatus[] = [
  BillingPlanChangeStatus.PROCESSING,
  BillingPlanChangeStatus.AWAITING_WEBHOOK,
  BillingPlanChangeStatus.REVIEW_REQUIRED,
];

export function planChangeConflict(code: string, message: string) {
  return new ConflictException({ code, message });
}

/**
 * Mirrors Paddle's customer-portal billing policy:
 * - tier upgrades are billed and provisioned immediately;
 * - same-cycle tier downgrades are provisioned immediately, while the credit
 *   is settled on the next invoice;
 * - billing-frequency changes must use an immediate mode because Paddle does
 *   not accept next-period proration when replacing monthly and annual prices.
 */
export function resolvePlanChangePolicy(
  currentPlan: BillingPlan,
  currentCycle: BillingCycle,
  targetPlan: BillingPlan,
  targetCycle: BillingCycle,
): PlanChangePolicy {
  const targetRank = PLAN_RANK[targetPlan];
  const currentRank = PLAN_RANK[currentPlan];
  const changeType =
    targetRank > currentRank
      ? 'upgrade'
      : targetRank < currentRank
        ? 'downgrade'
        : 'billing_cycle_change';
  const deferSettlement =
    changeType === 'downgrade' && currentCycle === targetCycle;

  return {
    changeType,
    settlementTiming: deferSettlement ? 'next_billing_period' : 'immediately',
    prorationBillingMode: deferSettlement
      ? 'prorated_next_billing_period'
      : 'prorated_immediately',
  };
}

export function subscriptionFingerprint(remote: Subscription) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: remote.id,
        customerId: remote.customerId,
        updatedAt: remote.updatedAt,
        status: remote.status,
        items: remote.items.map((item) => [item.price.id, item.quantity]),
        currency: remote.currencyCode,
        address: remote.addressId,
        business: remote.businessId,
        discount: remote.discount,
        nextBilledAt: remote.nextBilledAt,
        scheduledChange: remote.scheduledChange,
      }),
    )
    .digest('hex');
}

// All monetary values remain integer minor-unit strings. Never calculate a
// charge from the marketing prices or accept client-supplied totals.
export function planChangeAmounts(preview: SubscriptionPreview) {
  const update = preview.updateSummary;
  const recurring = preview.recurringTransactionDetails?.totals;
  const next = preview.nextTransaction?.details.totals;
  const immediate = preview.immediateTransaction?.details.totals;
  if (
    !update ||
    !recurring ||
    !next ||
    !preview.nextBilledAt ||
    !['charge', 'credit'].includes(update.result.action)
  ) {
    throw planChangeConflict(
      'BILLING_PREVIEW_UNAVAILABLE',
      'Paddle ücret önizlemesi tamamlanamadı. Lütfen tekrar deneyin.',
    );
  }
  const amounts = {
    currency: preview.currencyCode,
    credit: update.credit.amount,
    charge: update.charge.amount,
    difference: update.result.amount,
    differenceAction: update.result.action,
    dueNow: immediate?.grandTotal ?? '0',
    taxNow: immediate?.tax ?? '0',
    nextTotal: next.grandTotal,
    recurringTotal: recurring.grandTotal,
    nextBilledAt: preview.nextBilledAt,
  };
  const totals = [
    update.credit,
    update.charge,
    update.result,
    recurring,
    next,
    ...(immediate ? [immediate] : []),
  ];
  if (
    totals.some((value) => value.currencyCode !== amounts.currency) ||
    [
      amounts.credit,
      amounts.charge,
      amounts.difference,
      amounts.dueNow,
      amounts.taxNow,
      amounts.nextTotal,
      amounts.recurringTotal,
    ].some((value) => !/^-?\d+$/.test(value))
  ) {
    throw planChangeConflict(
      'BILLING_PREVIEW_UNAVAILABLE',
      'Paddle tutarları doğrulanamadı. İşlem başlatılmadı.',
    );
  }
  return amounts;
}
