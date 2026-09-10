import { ServiceUnavailableException } from '@nestjs/common';
import { Environment } from '@paddle/paddle-node-sdk';
import {
  BillingCycle,
  BillingPlan,
  PaddleEnvironment,
} from '../../generated/prisma/enums';

type PaddlePlanSelection = {
  plan: BillingPlan;
  cycle: BillingCycle;
};

const PRICE_ENV_KEYS: Record<BillingPlan, Record<BillingCycle, string>> = {
  [BillingPlan.STARTER]: {
    [BillingCycle.MONTHLY]: 'PADDLE_PRICE_STARTER_MONTHLY',
    [BillingCycle.ANNUAL]: 'PADDLE_PRICE_STARTER_ANNUAL',
  },
  [BillingPlan.GROWTH]: {
    [BillingCycle.MONTHLY]: 'PADDLE_PRICE_GROWTH_MONTHLY',
    [BillingCycle.ANNUAL]: 'PADDLE_PRICE_GROWTH_ANNUAL',
  },
  [BillingPlan.BUSINESS]: {
    [BillingCycle.MONTHLY]: 'PADDLE_PRICE_BUSINESS_MONTHLY',
    [BillingCycle.ANNUAL]: 'PADDLE_PRICE_BUSINESS_ANNUAL',
  },
};

export function paddleEnvironment() {
  const value = process.env.PADDLE_ENV?.trim().toLowerCase();
  return value === 'production' ? Environment.production : Environment.sandbox;
}

export function paddleCheckoutEnvironment() {
  return paddleEnvironment() === Environment.production
    ? PaddleEnvironment.PRODUCTION
    : PaddleEnvironment.SANDBOX;
}

export function requirePaddleApiKey() {
  return requireEnvironmentValue('PADDLE_API_KEY');
}

export function requirePaddleWebhookSecret() {
  return requireEnvironmentValue('PADDLE_WEBHOOK_SECRET');
}

export function paddlePriceId(plan: BillingPlan, cycle: BillingCycle) {
  return requireEnvironmentValue(PRICE_ENV_KEYS[plan][cycle]);
}

export function paddlePlanForPrice(
  priceId: string | null | undefined,
): PaddlePlanSelection | null {
  if (!priceId) return null;

  for (const plan of Object.values(BillingPlan)) {
    for (const cycle of Object.values(BillingCycle)) {
      const configuredPrice = process.env[PRICE_ENV_KEYS[plan][cycle]]?.trim();
      if (configuredPrice && configuredPrice === priceId) {
        return { plan, cycle };
      }
    }
  }

  return null;
}

function requireEnvironmentValue(key: string) {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new ServiceUnavailableException(
      `Paddle yapılandırması eksik: ${key}.`,
    );
  }
  return value;
}
