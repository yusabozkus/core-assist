import {
  BillingPlan,
  BillingSubscriptionStatus,
} from '../../generated/prisma/enums';

export const BILLING_TRIAL_DAYS = 10;

export type BillingEntitlements = {
  monthlyAiQuestions: number;
  stores: number;
  members: number;
  activeProducts: number;
  providerKeys: readonly string[];
};

const INCLUDED_PROVIDER_KEYS = ['trendyol', 'hepsiburada'] as const;

export const PLAN_ENTITLEMENTS: Readonly<
  Record<BillingPlan, BillingEntitlements>
> = {
  [BillingPlan.STARTER]: {
    monthlyAiQuestions: 1_500,
    stores: 1,
    members: 1,
    activeProducts: 5_000,
    providerKeys: INCLUDED_PROVIDER_KEYS,
  },
  [BillingPlan.GROWTH]: {
    monthlyAiQuestions: 5_000,
    stores: 5,
    members: 3,
    activeProducts: 25_000,
    providerKeys: INCLUDED_PROVIDER_KEYS,
  },
  [BillingPlan.BUSINESS]: {
    monthlyAiQuestions: 15_000,
    stores: 15,
    members: 10,
    activeProducts: 100_000,
    providerKeys: INCLUDED_PROVIDER_KEYS,
  },
};

export const TRIAL_ENTITLEMENTS: BillingEntitlements = {
  monthlyAiQuestions: 100,
  stores: 1,
  members: 1,
  activeProducts: 1_000,
  providerKeys: INCLUDED_PROVIDER_KEYS,
};

export function entitlementsFor(
  plan: BillingPlan,
  status: BillingSubscriptionStatus,
) {
  return status === BillingSubscriptionStatus.TRIALING
    ? TRIAL_ENTITLEMENTS
    : PLAN_ENTITLEMENTS[plan];
}
