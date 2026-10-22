import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Paddle } from '@paddle/paddle-node-sdk';
import { Prisma } from '../../generated/prisma/client';
import { BillingAuthorizationService } from './billing-authorization.service';
import { assertBillingActionOrigin } from './billing-action-origin';
import { PaddleBillingService } from './paddle-billing.service';
import { PaddleCheckoutBindingService } from './paddle-checkout-binding.service';

// These are isolated service-boundary tests. All credentials and identifiers
// below are synthetic; no environment file, database or provider is contacted.
function restoreEnvironment(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

void test('billing security: production mutations require the exact configured origin', () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    FRONTEND_URL: process.env.FRONTEND_URL,
  };
  try {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.audit.example';
    for (const origin of [
      undefined,
      'null',
      'https://attacker.example',
      'https://app.audit.example.attacker.example',
      'http://app.audit.example',
      'http://localhost:3001',
    ]) {
      assert.throws(
        () => assertBillingActionOrigin(origin),
        ForbiddenException,
      );
    }
    assert.doesNotThrow(() =>
      assertBillingActionOrigin('https://app.audit.example'),
    );
  } finally {
    restoreEnvironment(previous);
  }
});

function authorizationFixture(
  workspace: { ownerId: string; members: { role: string }[] } | null,
) {
  const prisma = {
    workspace: {
      findFirst: () =>
        Promise.resolve(workspace && { id: 'workspace-a', ...workspace }),
    },
  };
  return new BillingAuthorizationService(
    prisma as unknown as ConstructorParameters<
      typeof BillingAuthorizationService
    >[0],
  );
}

void test('billing security: store membership alone never confers financial authority', async () => {
  const service = authorizationFixture({ ownerId: 'owner', members: [] });
  assert.deepEqual(await service.getWorkspaceAccess('workspace-a', 'agent'), {
    workspaceId: 'workspace-a',
    canManageBilling: false,
  });
  await assert.rejects(
    service.requireWorkspaceAccess('workspace-a', 'agent'),
    ForbiddenException,
  );
});

void test('billing security: viewer and unrelated accounts cannot manage billing', async () => {
  for (const workspace of [
    null,
    { ownerId: 'owner', members: [{ role: 'VIEWER' }] },
    { ownerId: 'owner', members: [{ role: 'AGENT' }] },
  ]) {
    await assert.rejects(
      authorizationFixture(workspace).requireWorkspaceAccess(
        'workspace-a',
        'other',
      ),
      ForbiddenException,
    );
  }
});

void test('billing security: owner and delegated workspace administrator retain finance access', async () => {
  for (const [workspace, userId] of [
    [{ ownerId: 'owner', members: [] }, 'owner'],
    [{ ownerId: 'owner', members: [{ role: 'ADMIN' }] }, 'admin'],
  ] as const) {
    const service = authorizationFixture({
      ownerId: workspace.ownerId,
      members: [...workspace.members],
    });
    assert.deepEqual(
      await service.requireWorkspaceAccess('workspace-a', userId),
      { workspaceId: 'workspace-a' },
    );
  }
});

function emptyBillingService() {
  return new PaddleBillingService(
    ...([{}, {}, {}, {}, {}, {}, {}] as unknown as ConstructorParameters<
      typeof PaddleBillingService
    >),
  );
}

void test('billing security: actual Paddle SDK rejects forged, modified and expired webhook signatures', async () => {
  const previous = { PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET };
  const secret = 'synthetic-audit-webhook-secret';
  process.env.PADDLE_WEBHOOK_SECRET = secret;
  try {
    const service = emptyBillingService();
    Object.assign(service, { client: new Paddle('synthetic-unused-api-key') });
    const now = new Date().toISOString();
    const body = JSON.stringify({
      event_id: 'evt_audit_security',
      event_type: 'customer.created',
      occurred_at: now,
      notification_id: 'ntf_audit_security',
      data: {
        id: 'ctm_audit_security',
        name: 'Offline test',
        email: 'audit@example.invalid',
        locale: 'en',
        status: 'active',
        marketing_consent: false,
        custom_data: null,
        created_at: now,
        updated_at: now,
        import_meta: null,
      },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const sign = (ts: number, key = secret) =>
      `ts=${ts};h1=${createHmac('sha256', key).update(`${ts}:${body}`).digest('hex')}`;
    const verified = await service.verifyWebhook(body, sign(timestamp));
    assert.equal(verified.eventId, 'evt_audit_security');
    for (const [payload, signature] of [
      [body, undefined],
      [body, sign(timestamp, 'attacker-secret')],
      [body.replace('Offline test', 'Tampered event'), sign(timestamp)],
      [body, sign(timestamp - 60)],
    ]) {
      await assert.rejects(
        service.verifyWebhook(payload!, signature),
        BadRequestException,
      );
    }
  } finally {
    restoreEnvironment(previous);
  }
});

function bindingFixture(overrides: Record<string, unknown> = {}) {
  const writes: unknown[] = [];
  const checkout = {
    id: 'checkout-a',
    workspaceId: 'workspace-a',
    paddleTransactionId: 'txn-a',
    paddleSubscriptionId: null,
    status: 'OPEN',
    environment: 'SANDBOX',
    paddlePriceId: 'pri_audit_starter',
    plan: 'STARTER',
    cycle: 'MONTHLY',
    expectedPaddleCustomerId: 'ctm-a',
    previousPaddleSubscriptionId: null,
    boundAt: null,
    ...overrides,
  };
  const transaction = {
    $queryRaw: () => Promise.resolve([{ id: 'workspace-a' }]),
    billingCheckout: {
      findUnique: () => Promise.resolve(checkout),
      updateMany: (input: unknown) => {
        writes.push(input);
        return Promise.resolve({ count: 1 });
      },
    },
    billingSubscription: {
      findUnique: () =>
        Promise.resolve({
          id: 'local-sub-a',
          workspaceId: 'workspace-a',
          paddleCustomerId: 'ctm-a',
          paddleSubscriptionId: null,
          status: 'TRIALING',
        }),
    },
  } as unknown as Prisma.TransactionClient;
  const input = {
    paddleSubscriptionId: 'sub-a',
    paddleTransactionId: 'txn-a',
    paddleCustomerId: 'ctm-a',
    items: [
      {
        quantity: 1,
        price: {
          id: 'pri_audit_starter',
          billingCycle: { interval: 'month', frequency: 1 },
          trialPeriod: null,
        },
      },
    ],
  };
  return {
    service: new PaddleCheckoutBindingService(),
    transaction,
    input,
    writes,
  };
}

void test('billing security: subscription binding rejects foreign customers, prices, quantities and trials before writes', async () => {
  const previous = {
    PADDLE_ENV: process.env.PADDLE_ENV,
    PADDLE_PRICE_STARTER_MONTHLY: process.env.PADDLE_PRICE_STARTER_MONTHLY,
  };
  process.env.PADDLE_ENV = 'sandbox';
  process.env.PADDLE_PRICE_STARTER_MONTHLY = 'pri_audit_starter';
  try {
    const mutations: ((
      input: ReturnType<typeof bindingFixture>['input'],
    ) => unknown)[] = [
      (input) => ({ ...input, paddleCustomerId: 'ctm-victim' }),
      (input) => ({ ...input, items: [] }),
      (input) => ({ ...input, items: [{ ...input.items[0], quantity: 2 }] }),
      (input) => ({
        ...input,
        items: [
          {
            ...input.items[0],
            price: { ...input.items[0].price, id: 'pri_attacker' },
          },
        ],
      }),
      (input) => ({
        ...input,
        items: [
          {
            ...input.items[0],
            price: {
              ...input.items[0].price,
              trialPeriod: { interval: 'day', frequency: 30 },
            },
          },
        ],
      }),
      (input) => ({
        ...input,
        items: [
          {
            ...input.items[0],
            price: {
              ...input.items[0].price,
              billingCycle: { interval: 'year', frequency: 1 },
            },
          },
        ],
      }),
    ];
    for (const mutate of mutations) {
      const { service, transaction, input, writes } = bindingFixture();
      await assert.rejects(
        service.resolve(
          transaction,
          mutate(input) as Parameters<
            PaddleCheckoutBindingService['resolve']
          >[1],
        ),
        ConflictException,
      );
      assert.equal(writes.length, 0);
    }
    for (const overrides of [
      { status: 'CANCELED' },
      { environment: 'PRODUCTION' },
      { paddleSubscriptionId: 'sub-victim' },
      { previousPaddleSubscriptionId: 'sub-victim' },
    ]) {
      const { service, transaction, input, writes } = bindingFixture(overrides);
      await assert.rejects(
        service.resolve(transaction, input),
        ConflictException,
      );
      assert.equal(writes.length, 0);
    }
    const valid = bindingFixture();
    const result = await valid.service.resolve(valid.transaction, valid.input);
    assert.equal(result.subscription.workspaceId, 'workspace-a');
    assert.equal(valid.writes.length, 1);
  } finally {
    restoreEnvironment(previous);
  }
});

void test('billing security: invoices are scoped to the authorized Paddle customer', async () => {
  const calls: string[] = [];
  const dependencies = [
    {},
    {
      getOrCreateForWorkspace: () =>
        Promise.resolve({ paddleCustomerId: 'ctm-a' }),
    },
    {},
    {},
    {
      requireWorkspaceAccess: () =>
        Promise.resolve({ workspaceId: 'workspace-a' }),
    },
    {},
    {},
  ] as unknown as ConstructorParameters<typeof PaddleBillingService>;
  const service = new PaddleBillingService(...dependencies);
  Object.assign(service, {
    client: {
      transactions: {
        get: (id: string) => {
          calls.push(`read:${id}`);
          return Promise.resolve({
            customerId: id === 'txn-a' ? 'ctm-a' : 'ctm-victim',
          });
        },
        getInvoicePDF: (id: string) => {
          calls.push(`pdf:${id}`);
          return Promise.resolve({
            url: 'https://paddle.example.invalid/audit.pdf',
          });
        },
      },
    },
  });
  await assert.rejects(
    service.getInvoicePdf('workspace-a', 'owner', 'txn-victim'),
    NotFoundException,
  );
  assert.deepEqual(calls, ['read:txn-victim']);
  assert.deepEqual(
    await service.getInvoicePdf('workspace-a', 'owner', 'txn-a'),
    {
      url: 'https://paddle.example.invalid/audit.pdf',
    },
  );
  assert.deepEqual(calls, ['read:txn-victim', 'read:txn-a', 'pdf:txn-a']);
});
