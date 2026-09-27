import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasBillingAccess } from './billing-access.policy';
import { resolveBillingUsageWindow } from './billing-usage-window';

const now = new Date('2028-02-29T12:00:00Z');
const base = {
  status: 'ACTIVE' as const,
  trialEndsAt: null,
  paddleSubscriptionId: 'sub_test',
  currentPeriodEnd: now,
};
void test('renewal grace is fixed and unavailable for known failure, cancellation or trials', () => {
  assert.equal(hasBillingAccess(base, now), true);
  assert.equal(
    hasBillingAccess(base, new Date(now.getTime() + 30 * 60_000 - 1)),
    true,
  );
  assert.equal(
    hasBillingAccess(base, new Date(now.getTime() + 30 * 60_000)),
    false,
  );
  for (const state of [
    { ...base, status: 'PAST_DUE' as const },
    { ...base, status: 'CANCELED' as const },
    { ...base, status: 'PAUSED' as const },
    { ...base, status: 'TRIALING' as const, trialEndsAt: now },
    { ...base, cancelAtPeriodEnd: true },
    { ...base, scheduledAccessEndsAt: now },
    { ...base, paddleSubscriptionId: null },
  ])
    assert.equal(hasBillingAccess(state, now), false);
});

void test('annual quota windows clamp month-end without losing the original anchor', () => {
  const subscription = {
    status: 'ACTIVE' as const,
    cycle: 'ANNUAL' as const,
    currentPeriodStart: new Date('2028-01-31T12:00:00Z'),
    currentPeriodEnd: new Date('2029-01-31T12:00:00Z'),
    usagePeriodAnchor: new Date('2028-01-31T12:00:00Z'),
  };
  const february = resolveBillingUsageWindow(subscription, now);
  assert.equal(february.start.toISOString(), '2028-02-29T12:00:00.000Z');
  assert.equal(february.end.toISOString(), '2028-03-31T12:00:00.000Z');
  const expired = resolveBillingUsageWindow(
    subscription,
    new Date('2029-02-10'),
  );
  assert.equal(expired.start.toISOString(), '2028-12-31T12:00:00.000Z');
  assert.equal(expired.end.toISOString(), '2029-01-31T12:00:00.000Z');
});
