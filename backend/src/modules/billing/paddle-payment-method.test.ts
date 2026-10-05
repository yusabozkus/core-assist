import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaddleBillingService } from './paddle-billing.service';
import { BillingController } from './billing.controller';

const transactionId = 'txn_01h04vsc0qhwtsbsxh7xmb1z3e';
const method = {
  type: 'card',
  brand: 'visa',
  last4: '4242',
  expiryMonth: 12,
  expiryYear: 2030,
};

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    id: transactionId,
    subscriptionId: 'sub-current',
    customerId: 'customer-current',
    collectionMode: 'automatic',
    status: 'ready',
    origin: 'subscription_payment_method_change',
    currencyCode: 'TRY',
    details: {
      totals: { subtotal: '0', tax: '0', total: '0', balance: '0' },
      lineItems: [{ product: { name: 'Core Asistan Growth' }, quantity: 1 }],
    },
    payments: [
      {
        status: 'captured',
        methodDetails: {
          type: 'card',
          card: {
            type: 'visa',
            last4: '4242',
            expiryMonth: 12,
            expiryYear: 2030,
          },
        },
      },
    ],
    billedAt: '2026-10-05T12:00:00Z',
    updatedAt: '2026-10-05T12:00:00Z',
    address: null,
    business: null,
    customer: { name: 'Test Customer', email: 'test@example.com' },
    adjustmentsTotals: null,
    items: [],
    billingPeriod: null,
    ...overrides,
  };
}

function fixture({
  authorized = true,
  current = {},
  payment = transaction(),
  history = [] as ReturnType<typeof transaction>[],
} = {}) {
  const calls: string[] = [];
  const client = {
    subscriptions: {
      get: (id: string) => {
        calls.push(`subscription:${id}`);
        return Promise.resolve({
          id: 'sub-current',
          customerId: 'customer-current',
          status: 'active',
          collectionMode: 'automatic',
          ...current,
        });
      },
      getPaymentMethodChangeTransaction: (id: string) => {
        calls.push(`prepare:${id}`);
        return Promise.resolve(payment);
      },
    },
    transactions: {
      get: (id: string) => {
        calls.push(`transaction:${id}`);
        return Promise.resolve(payment);
      },
      list: () => history,
    },
  };
  const dependencies = [
    {},
    {
      getOrCreateForWorkspace: (id: string) => {
        calls.push(`workspace:${id}`);
        return Promise.resolve({
          paddleSubscriptionId: 'sub-current',
          paddleCustomerId: 'customer-current',
        });
      },
    },
    {},
    {},
    {
      requireWorkspaceAccess: (id: string, userId: string) => {
        calls.push(`authorize:${id}:${userId}`);
        if (!authorized) throw new ForbiddenException();
        return Promise.resolve({ workspaceId: id });
      },
    },
    {},
    {},
  ] as unknown as ConstructorParameters<typeof PaddleBillingService>;
  const service = new PaddleBillingService(...dependencies);
  Object.assign(service, { client });
  return { service, calls };
}

void test('billing permission is checked before reading or preparing any Paddle transaction', async () => {
  const { service, calls } = fixture({ authorized: false });
  await assert.rejects(
    service.createPaymentMethodCheckout('workspace-a', 'agent'),
    ForbiddenException,
  );
  await assert.rejects(
    service.getPaymentMethodCheckoutStatus(
      'workspace-a',
      'agent',
      transactionId,
    ),
    ForbiddenException,
  );
  assert.deepEqual(calls, [
    'authorize:workspace-a:agent',
    'authorize:workspace-a:agent',
  ]);
});

void test('active payment method changes prepare a zero-value checkout without charging or changing a plan', async () => {
  const { service, calls } = fixture();
  const result = await service.createPaymentMethodCheckout(
    'workspace-a',
    'owner',
  );
  assert.equal(result.transactionId, transactionId);
  assert.equal(result.requiresPayment, false);
  assert.equal(result.total, 0);
  assert.equal(result.amountDue, 0);
  assert.deepEqual(calls, [
    'authorize:workspace-a:owner',
    'workspace:workspace-a',
    'subscription:sub-current',
    'prepare:sub-current',
  ]);
});

void test('live Paddle status determines overdue payment and exposes totals and remaining balance', async () => {
  const { service } = fixture({
    current: { status: 'past_due' },
    payment: transaction({
      status: 'past_due',
      origin: 'subscription_recurring',
      details: {
        totals: {
          subtotal: '10000',
          tax: '2000',
          total: '12000',
          balance: '6000',
        },
        lineItems: [{ product: { name: 'Core Asistan Growth' }, quantity: 1 }],
      },
    }),
  });
  const result = await service.createPaymentMethodCheckout(
    'workspace-a',
    'owner',
  );
  assert.equal(result.requiresPayment, true);
  assert.equal(result.total, 120);
  assert.equal(result.amountDue, 60);
  assert.equal(result.tax, 20);
  assert.equal(result.currency, 'TRY');
});

void test('unsupported subscriptions cannot start a payment update checkout', async () => {
  for (const current of [
    { status: 'paused' },
    { status: 'canceled' },
    { status: 'trialing' },
    { collectionMode: 'manual' },
  ]) {
    const { service, calls } = fixture({ current });
    await assert.rejects(
      service.createPaymentMethodCheckout('workspace-a', 'owner'),
      ConflictException,
    );
    assert.ok(!calls.some((call) => call.startsWith('prepare:')));
  }
});

void test('subscription customer and returned transaction bindings cannot cross workspaces', async () => {
  for (const options of [
    { current: { customerId: 'other-customer' } },
    { payment: transaction({ customerId: 'other-customer' }) },
    { payment: transaction({ subscriptionId: 'other-subscription' }) },
  ]) {
    const { service } = fixture(options);
    await assert.rejects(
      service.createPaymentMethodCheckout('workspace-a', 'owner'),
      ConflictException,
    );
  }
});

void test('an active update cannot accidentally open a billable or unrelated transaction', async () => {
  for (const payment of [
    transaction({ origin: 'subscription_recurring' }),
    transaction({
      details: {
        totals: { subtotal: '100', tax: '0', total: '100', balance: '100' },
        lineItems: [],
      },
    }),
    transaction({ details: null }),
    transaction({ collectionMode: 'manual' }),
    transaction({ status: 'completed' }),
  ]) {
    const { service } = fixture({ payment });
    await assert.rejects(
      service.createPaymentMethodCheckout('workspace-a', 'owner'),
      ConflictException,
    );
  }
});

void test('invalid amounts are rejected instead of displaying a misleading zero or charge', async () => {
  for (const total of ['not-a-number', '-100']) {
    const { service } = fixture({
      payment: transaction({
        details: {
          totals: { subtotal: '0', tax: '0', total, balance: total },
          lineItems: [],
        },
      }),
    });
    await assert.rejects(
      service.createPaymentMethodCheckout('workspace-a', 'owner'),
      ConflictException,
    );
  }
});

void test('completion comes from Paddle server data and is not inferred from a captured payment alone', async () => {
  const pending = fixture({ payment: transaction({ status: 'paid' }) });
  assert.deepEqual(
    await pending.service.getPaymentMethodCheckoutStatus(
      'workspace-a',
      'owner',
      transactionId,
    ),
    {
      completed: false,
      paymentMethod: null,
    },
  );
  const completed = fixture({ payment: transaction({ status: 'completed' }) });
  assert.deepEqual(
    await completed.service.getPaymentMethodCheckoutStatus(
      'workspace-a',
      'owner',
      transactionId,
    ),
    {
      completed: true,
      paymentMethod: method,
    },
  );
});

void test('verification cannot expose another customer or subscription payment details', async () => {
  for (const overrides of [
    { customerId: 'other-customer' },
    { subscriptionId: 'other-subscription' },
  ]) {
    const { service } = fixture({ payment: transaction(overrides) });
    await assert.rejects(
      service.getPaymentMethodCheckoutStatus(
        'workspace-a',
        'owner',
        transactionId,
      ),
      NotFoundException,
    );
  }
  const { service, calls } = fixture();
  await assert.rejects(
    service.getPaymentMethodCheckoutStatus('workspace-a', 'owner', '../bad-id'),
    NotFoundException,
  );
  assert.ok(!calls.some((call) => call.startsWith('transaction:')));
});

void test('the most recently captured payment supplies the updated card even when attempts arrive out of order', async () => {
  const { service } = fixture({
    payment: transaction({
      status: 'completed',
      payments: [
        {
          status: 'captured',
          capturedAt: '2026-10-01T12:00:00Z',
          methodDetails: {
            type: 'card',
            card: {
              type: 'visa',
              last4: '1111',
              expiryMonth: 1,
              expiryYear: 2028,
            },
          },
        },
        {
          status: 'captured',
          capturedAt: '2026-10-05T12:00:00Z',
          methodDetails: {
            type: 'card',
            card: {
              type: 'visa',
              last4: '4242',
              expiryMonth: 12,
              expiryYear: 2030,
            },
          },
        },
      ],
    }),
  });
  const result = await service.getPaymentMethodCheckoutStatus(
    'workspace-a',
    'owner',
    transactionId,
  );
  assert.deepEqual(result.paymentMethod, method);
});

void test('card changes update the displayed method without adding a zero-value invoice', async () => {
  const { service } = fixture({
    history: [
      transaction({ status: 'completed' }),
      transaction({
        id: 'txn-older',
        status: 'completed',
        origin: 'subscription_recurring',
        billedAt: '2026-10-01T12:00:00Z',
      }),
    ],
  });
  const result = await service.getBillingHistory('workspace-a', 'owner');
  assert.deepEqual(result.paymentMethod, method);
  assert.equal(result.invoices.length, 1);
  assert.equal(result.invoices[0].transactionId, 'txn-older');
});

void test('a newer payment on another subscription does not replace this subscription card', async () => {
  const { service } = fixture({
    history: [
      transaction({ subscriptionId: 'other-subscription', payments: [] }),
      transaction({ status: 'completed', billedAt: '2026-10-01T12:00:00Z' }),
    ],
  });
  const result = await service.getBillingHistory('workspace-a', 'owner');
  assert.deepEqual(result.paymentMethod, method);
});

void test('missing request origin is rejected before a payment update is prepared', () => {
  const { service, calls } = fixture();
  const controller = new BillingController(
    ...([{}, service, {}, {}] as unknown as ConstructorParameters<
      typeof BillingController
    >),
  );
  assert.throws(
    () =>
      controller.createPaymentMethodCheckout(
        'workspace-a',
        { id: 'owner' } as never,
        undefined,
      ),
    ForbiddenException,
  );
  assert.deepEqual(calls, []);
});
