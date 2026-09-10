import { createHash } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import type {
  Subscription,
  SubscriptionPreview,
} from '@paddle/paddle-node-sdk';
import { BillingPlanChangeStatus } from '../../generated/prisma/enums';

export const PENDING_PLAN_CHANGE_STATUSES: BillingPlanChangeStatus[] = [
  BillingPlanChangeStatus.PROCESSING,
  BillingPlanChangeStatus.AWAITING_WEBHOOK,
  BillingPlanChangeStatus.REVIEW_REQUIRED,
];

export function planChangeConflict(code: string, message: string) {
  return new ConflictException({ code, message });
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
