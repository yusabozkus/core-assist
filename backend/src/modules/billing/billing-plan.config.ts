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

type BillingCapacityLimits = Omit<BillingEntitlements, 'providerKeys'>;

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

export const MAX_PLAN_ACTIVE_PRODUCTS = Math.max(
  ...Object.values(PLAN_ENTITLEMENTS).map((plan) => plan.activeProducts),
);

export const TRIAL_ENTITLEMENTS: BillingEntitlements = {
  monthlyAiQuestions: 100,
  stores: 1,
  members: 1,
  activeProducts: 1_000,
  providerKeys: INCLUDED_PROVIDER_KEYS,
};

const BILLING_TEST_LIMIT_DEFAULTS: BillingCapacityLimits = {
  monthlyAiQuestions: 10,
  stores: 1,
  members: 2,
  activeProducts: 5,
};

const billingTestLimits = resolveBillingTestLimits();

export function planEntitlementsFor(plan: BillingPlan) {
  return applyBillingTestLimits(PLAN_ENTITLEMENTS[plan]);
}

export function entitlementsFor(
  plan: BillingPlan,
  status: BillingSubscriptionStatus,
) {
  const entitlements =
    status === BillingSubscriptionStatus.TRIALING
      ? TRIAL_ENTITLEMENTS
      : PLAN_ENTITLEMENTS[plan];

  return applyBillingTestLimits(entitlements);
}

function applyBillingTestLimits(
  entitlements: BillingEntitlements,
): BillingEntitlements {
  return billingTestLimits
    ? { ...entitlements, ...billingTestLimits }
    : entitlements;
}

function resolveBillingTestLimits(): BillingCapacityLimits | null {
  if (
    process.env.BILLING_TEST_LIMITS_ENABLED?.trim().toLowerCase() !== 'true'
  ) {
    return null;
  }

  if (process.env.NODE_ENV?.trim().toLowerCase() === 'production') {
    throw new Error(
      'BILLING_TEST_LIMITS_ENABLED cannot be enabled in production.',
    );
  }

  return {
    monthlyAiQuestions: positiveIntegerEnvironmentValue(
      'BILLING_TEST_AI_QUESTIONS',
      BILLING_TEST_LIMIT_DEFAULTS.monthlyAiQuestions,
    ),
    stores: positiveIntegerEnvironmentValue(
      'BILLING_TEST_STORES',
      BILLING_TEST_LIMIT_DEFAULTS.stores,
    ),
    members: positiveIntegerEnvironmentValue(
      'BILLING_TEST_MEMBERS',
      BILLING_TEST_LIMIT_DEFAULTS.members,
    ),
    activeProducts: positiveIntegerEnvironmentValue(
      'BILLING_TEST_PRODUCTS',
      BILLING_TEST_LIMIT_DEFAULTS.activeProducts,
    ),
  };
}

function positiveIntegerEnvironmentValue(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}
