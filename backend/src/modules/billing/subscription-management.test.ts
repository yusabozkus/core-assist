import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validate } from 'class-validator';
import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiError, type Subscription } from '@paddle/paddle-node-sdk';
import { PaddleBillingService } from './paddle-billing.service';
import { BillingController } from './billing.controller';
import { ManageSubscriptionDto } from './dto/manage-subscription.dto';
import { subscriptionManagementState } from './subscription-management.policy';

const subscriptionId = 'sub_01h04vsc0qhwtsbsxh3422wjs4';
const updatedAt = '2026-10-05T12:00:00Z';
const endsAt = '2099-11-05T12:00:00Z';

function remote(overrides: Record<string, unknown> = {}) {
  return {
    id: subscriptionId,
    customerId: 'customer-current',
    status: 'active',
    collectionMode: 'automatic',
    updatedAt,
    nextBilledAt: endsAt,
    currentBillingPeriod: { startsAt: updatedAt, endsAt },
    scheduledChange: null,
    ...overrides,
  } as unknown as Subscription;
}

function fixture({
  current = remote(),
  authorized = true,
  pendingPlan = false,
  writeError = false,
  syncError = false,
  wrongResult = false,
  providerRejection = false,
} = {}) {
  const calls: { name: string; input?: unknown }[] = [];
  let snapshot = current;
  const local = {
    paddleSubscriptionId: subscriptionId,
    paddleCustomerId: 'customer-current',
    status: 'ACTIVE',
    cancelAtPeriodEnd: false,
  };
  const client = {
    subscriptions: {
      get: (id: string) => {
        calls.push({ name: 'read', input: id });
        return Promise.resolve(snapshot);
      },
      cancel: (id: string, input: unknown) => {
        calls.push({ name: 'cancel', input });
        if (providerRejection)
          throw new ApiError(
            {
              type: 'request_error',
              code: 'invalid_field',
              detail: 'Sensitive provider detail',
              documentation_url: '',
            },
            null,
          );
        if (writeError) throw new Error('Sensitive provider error');
        snapshot = remote({
          ...snapshot,
          id: wrongResult ? 'wrong-subscription' : id,
          scheduledChange: { action: 'cancel', effectiveAt: endsAt },
          nextBilledAt: null,
        });
        return Promise.resolve(snapshot);
      },
      update: (id: string, input: unknown) => {
        calls.push({ name: 'update', input });
        if (writeError) throw new Error('Sensitive provider error');
        snapshot = remote({
          ...snapshot,
          id,
          scheduledChange: null,
          nextBilledAt: endsAt,
        });
        return Promise.resolve(snapshot);
      },
    },
  };
  const dependencies = [
    {
      billingPlanChange: {
        findFirst: () =>
          Promise.resolve(pendingPlan ? { id: 'pending' } : null),
      },
      billingSubscription: { findUniqueOrThrow: () => Promise.resolve(local) },
    },
    { getOrCreateForWorkspace: () => Promise.resolve(local) },
    {},
    {},
    {
      requireWorkspaceAccess: () => {
        calls.push({ name: 'authorize' });
        if (!authorized) throw new ForbiddenException();
        return Promise.resolve({});
      },
    },
    {},
    {
      record: (input: unknown) => {
        calls.push({ name: 'audit-start', input });
        return Promise.resolve();
      },
      recordSafely: (input: unknown) => {
        calls.push({ name: 'audit-result', input });
        return Promise.resolve();
      },
    },
  ] as unknown as ConstructorParameters<typeof PaddleBillingService>;
  const service = new PaddleBillingService(...dependencies);
  Object.assign(service, {
    client,
    reconcileWorkspace: () => {
      calls.push({ name: 'reconcile' });
      if (syncError) throw new Error('Database unavailable');
      local.status = snapshot.status.toUpperCase();
      local.cancelAtPeriodEnd = snapshot.scheduledChange?.action === 'cancel';
      return Promise.resolve();
    },
  });
  return {
    service,
    calls,
    input: { action: 'cancel' as const, subscriptionId, updatedAt },
  };
}

void test('billing permission precedes every Paddle read or write', async () => {
  const f = fixture({ authorized: false });
  await assert.rejects(
    f.service.getSubscriptionManagement('ws', 'agent'),
    ForbiddenException,
  );
  await assert.rejects(
    f.service.manageSubscription('ws', 'agent', f.input),
    ForbiddenException,
  );
  assert.deepEqual(
    f.calls.map((call) => call.name),
    ['authorize', 'authorize'],
  );
});

void test('cancellation is scheduled at period end, preserving active status and access date', async () => {
  const f = fixture();
  const result = await f.service.manageSubscription('ws', 'owner', f.input);
  assert.deepEqual(f.calls.find((call) => call.name === 'cancel')?.input, {
    effectiveFrom: 'next_billing_period',
  });
  assert.equal(result.subscription.status, 'active');
  assert.equal(result.subscription.accessEndsAt, endsAt);
  assert.equal(result.subscription.cancellationScheduled, true);
  assert.equal(result.synchronized, true);
  assert.ok(!f.calls.some((call) => call.name === 'update'));
});

void test('undoing scheduled cancellation only clears the scheduled change, with no new charge or resume', async () => {
  const f = fixture({
    current: remote({
      scheduledChange: { action: 'cancel', effectiveAt: endsAt },
      nextBilledAt: null,
    }),
  });
  const result = await f.service.manageSubscription('ws', 'owner', {
    ...f.input,
    action: 'reverse_cancellation',
  });
  assert.deepEqual(f.calls.find((call) => call.name === 'update')?.input, {
    scheduledChange: null,
  });
  assert.equal(result.subscription.cancellationScheduled, false);
  assert.equal(result.subscription.nextBilledAt, endsAt);
  assert.ok(!f.calls.some((call) => call.name === 'cancel'));
});

void test('repeating a completed request never repeats the Paddle write', async () => {
  const f = fixture();
  await f.service.manageSubscription('ws', 'owner', f.input);
  await f.service.manageSubscription('ws', 'owner', f.input);
  assert.equal(f.calls.filter((call) => call.name === 'cancel').length, 1);
});

void test('another subscription cannot be modified or read as this workspace subscription', async () => {
  const f = fixture({ current: remote({ customerId: 'other-customer' }) });
  await assert.rejects(
    f.service.manageSubscription('ws', 'owner', f.input),
    ConflictException,
  );
  assert.ok(
    !f.calls.some((call) => call.name === 'cancel' || call.name === 'update'),
  );
  const other = fixture();
  await assert.rejects(
    other.service.manageSubscription('ws', 'owner', {
      ...other.input,
      subscriptionId: 'other-subscription',
    }),
    ConflictException,
  );
});

void test('a stale confirmation is rejected before cancellation', async () => {
  const f = fixture({ current: remote({ updatedAt: '2026-10-06T12:00:00Z' }) });
  await assert.rejects(
    f.service.manageSubscription('ws', 'owner', f.input),
    ConflictException,
  );
  assert.ok(!f.calls.some((call) => call.name === 'cancel'));
});

void test('scheduled pauses and resumes are never removed by the cancellation flow', async () => {
  for (const action of ['pause', 'resume']) {
    const f = fixture({
      current: remote({ scheduledChange: { action, effectiveAt: endsAt } }),
    });
    await assert.rejects(
      f.service.manageSubscription('ws', 'owner', {
        ...f.input,
        action: 'reverse_cancellation',
      }),
      ConflictException,
    );
    assert.ok(!f.calls.some((call) => call.name === 'update'));
  }
});

void test('pending plan changes block new subscription writes', async () => {
  const f = fixture({ pendingPlan: true });
  const state = await f.service.getSubscriptionManagement('ws', 'owner');
  assert.equal(state.action, null);
  await assert.rejects(
    f.service.manageSubscription('ws', 'owner', f.input),
    ConflictException,
  );
  assert.ok(!f.calls.some((call) => call.name === 'cancel'));
});

void test('past-due and manually collected subscriptions cannot submit unsupported renewal changes', async () => {
  for (const current of [
    remote({ status: 'past_due' }),
    remote({ collectionMode: 'manual' }),
  ]) {
    const f = fixture({ current });
    const state = await f.service.getSubscriptionManagement('ws', 'owner');
    assert.equal(state.action, null);
    await assert.rejects(
      f.service.manageSubscription('ws', 'owner', f.input),
      ConflictException,
    );
    assert.ok(!f.calls.some((call) => call.name === 'cancel'));
  }
});

void test('terminal cancellation cannot be reinstated by clearing its scheduled change', async () => {
  const f = fixture({
    current: remote({ status: 'canceled', currentBillingPeriod: null }),
  });
  await assert.rejects(
    f.service.manageSubscription('ws', 'owner', {
      ...f.input,
      action: 'reverse_cancellation',
    }),
    ConflictException,
  );
  assert.equal(
    (await f.service.getSubscriptionManagement('ws', 'owner')).action,
    null,
  );
  assert.ok(!f.calls.some((call) => call.name === 'update'));
});

void test('missing, expired and near-expiring periods never fall back to immediate cancellation', () => {
  const now = Date.parse(updatedAt);
  for (const current of [
    remote({ currentBillingPeriod: null }),
    remote({ currentBillingPeriod: { endsAt: updatedAt } }),
    remote({
      currentBillingPeriod: {
        endsAt: new Date(now + 10 * 60_000).toISOString(),
      },
    }),
  ]) {
    assert.equal(subscriptionManagementState(current, false, now).action, null);
  }
});

void test('provider failures have an unknown outcome without exposing provider details or retrying the write', async () => {
  const f = fixture({ writeError: true });
  await assert.rejects(
    f.service.manageSubscription('ws', 'owner', f.input),
    (error: unknown) => {
      assert.ok(error instanceof BadGatewayException);
      assert.equal(
        (error.getResponse() as { code: string }).code,
        'SUBSCRIPTION_RESULT_UNKNOWN',
      );
      assert.ok(!error.message.includes('Sensitive'));
      return true;
    },
  );
  assert.equal(f.calls.filter((call) => call.name === 'cancel').length, 1);
  assert.ok(!f.calls.some((call) => call.name === 'reconcile'));
});

void test('an unexpected provider response is not accepted as successful', async () => {
  const f = fixture({ wrongResult: true });
  await assert.rejects(
    f.service.manageSubscription('ws', 'owner', f.input),
    BadGatewayException,
  );
  assert.ok(!f.calls.some((call) => call.name === 'reconcile'));
});

void test('a definite Paddle rejection is distinguishable from an unknown write outcome', async () => {
  const f = fixture({ providerRejection: true });
  await assert.rejects(
    f.service.manageSubscription('ws', 'owner', f.input),
    (error: unknown) => {
      assert.ok(error instanceof ConflictException);
      assert.equal(
        (error.getResponse() as { code: string }).code,
        'SUBSCRIPTION_CHANGE_REJECTED',
      );
      assert.ok(!error.message.includes('Sensitive'));
      return true;
    },
  );
  assert.equal(f.calls.filter((call) => call.name === 'cancel').length, 1);
});

void test('successful Paddle cancellation with failed local synchronization remains pending', async () => {
  const f = fixture({ syncError: true });
  const result = await f.service.manageSubscription('ws', 'owner', f.input);
  assert.equal(result.completed, true);
  assert.equal(result.synchronized, false);
  assert.equal(result.subscription.cancellationScheduled, true);
  assert.equal(f.calls.filter((call) => call.name === 'cancel').length, 1);
});

void test('subscription mutations reject missing or foreign origins before accessing the service', () => {
  const f = fixture();
  const controller = new BillingController(
    ...([{}, f.service, {}, {}] as unknown as ConstructorParameters<
      typeof BillingController
    >),
  );
  for (const origin of [undefined, 'https://foreign.example']) {
    assert.throws(
      () =>
        controller.manageSubscription(
          'ws',
          { id: 'owner' } as never,
          f.input,
          origin,
        ),
      ForbiddenException,
    );
  }
  assert.deepEqual(f.calls, []);
});

void test('request validation rejects unsupported actions, invalid identifiers and missing versions', async () => {
  const valid = Object.assign(new ManageSubscriptionDto(), {
    action: 'cancel',
    subscriptionId,
    updatedAt,
  });
  assert.equal((await validate(valid)).length, 0);
  for (const overrides of [
    { action: 'immediate_cancel' },
    { subscriptionId: 'another-id' },
    { updatedAt: undefined },
  ]) {
    assert.ok(
      (
        await validate(
          Object.assign(new ManageSubscriptionDto(), valid, overrides),
        )
      ).length > 0,
    );
  }
});
