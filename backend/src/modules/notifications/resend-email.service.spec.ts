import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { PrismaService } from '../../database/prisma.service';
import { EmailDeliveryStatus } from '../../generated/prisma/enums';
import { ResendEmailService } from './resend-email.service';

function createHarness() {
  const records = new Map<string, Record<string, unknown>>();
  const model = {
    upsert: (query: {
      where: { deliveryKey: string };
      create: Record<string, unknown>;
    }) => {
      let record = records.get(query.where.deliveryKey);
      if (!record) {
        record = {
          id: `delivery-${records.size + 1}`,
          ...query.create,
          status: EmailDeliveryStatus.PENDING,
          attemptCount: 0,
          firstAttemptAt: null,
          nextAttemptAt: new Date(0),
          claimToken: null,
          claimUntil: null,
        };
        records.set(query.where.deliveryKey, record);
      }
      return Promise.resolve({ id: record.id });
    },
    findUnique: (query: { where: { id: string } }) =>
      Promise.resolve(
        [...records.values()].find((record) => record.id === query.where.id) ??
          null,
      ),
    findMany: () =>
      Promise.resolve(
        [...records.values()]
          .filter(
            (record) =>
              record.status === EmailDeliveryStatus.PENDING &&
              (record.nextAttemptAt as Date) <= new Date(),
          )
          .map((record) => ({ id: record.id as string })),
      ),
    updateMany: (query: {
      where: {
        id: string;
        status?: EmailDeliveryStatus;
        claimToken?: string;
      };
      data: Record<string, unknown>;
    }) => {
      const record = [...records.values()].find(
        (candidate) => candidate.id === query.where.id,
      );
      if (
        !record ||
        (query.where.status && record.status !== query.where.status) ||
        (query.where.claimToken && record.claimToken !== query.where.claimToken)
      )
        return Promise.resolve({ count: 0 });
      for (const [key, value] of Object.entries(query.data)) {
        record[key] =
          value && typeof value === 'object' && 'increment' in value
            ? Number(record[key]) + Number(value.increment)
            : value;
      }
      return Promise.resolve({ count: 1 });
    },
    deleteMany: () => Promise.resolve({ count: 0 }),
  };
  const service = new ResendEmailService({
    emailDeliveryRecord: model,
  } as unknown as PrismaService);
  const input = {
    deliveryKey: 'notification:record-1:1',
    recipientUserId: 'user-1',
    storeId: 'store-1',
    recipientEmail: 'person@example.com',
    senderEmail: 'support@example.com',
    subject: 'Test mail',
    html: '<p>Test</p>',
  };
  return { service, input, records };
}

void test('transient 429 is retried with the same key and payload, then records the provider id', async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFetch = global.fetch;
  process.env.RESEND_API_KEY = 'test-key';
  const requests: Array<{ key: string | null; body: string }> = [];
  global.fetch = (_url: string | URL | Request, options?: RequestInit) => {
    requests.push({
      key: new Headers(options?.headers).get('Idempotency-Key'),
      body: typeof options?.body === 'string' ? options.body : '',
    });
    return Promise.resolve(
      requests.length === 1
        ? new Response('{"name":"rate_limit_exceeded"}', {
            status: 429,
            headers: { 'retry-after': '2' },
          })
        : Response.json({ id: 'resend-message-1' }),
    );
  };

  try {
    const { service, input, records } = createHarness();
    assert.equal(await service.send(input), 'DEFERRED');
    const record = records.get(input.deliveryKey)!;
    assert.equal(record.status, EmailDeliveryStatus.PENDING);
    assert.equal(record.attemptCount, 1);
    assert.ok((record.nextAttemptAt as Date).getTime() > Date.now());
    record.nextAttemptAt = new Date(0);
    await service.sweepDue();
    assert.equal(record.status, EmailDeliveryStatus.SENT);
    assert.equal(record.providerMessageId, 'resend-message-1');
    assert.equal(record.html, null);
    assert.equal(await service.send({ ...input, subject: 'Changed' }), 'SENT');
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});

void test('permanent Resend rejection is recorded without repeated sends', async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFetch = global.fetch;
  process.env.RESEND_API_KEY = 'test-key';
  let requests = 0;
  global.fetch = () => {
    requests += 1;
    return Promise.resolve(
      new Response('{"name":"validation_error"}', { status: 400 }),
    );
  };
  try {
    const { service, input, records } = createHarness();
    assert.equal(await service.send(input), 'FAILED');
    assert.equal(await service.send(input), 'FAILED');
    await service.sweepDue();
    assert.equal(
      records.get(input.deliveryKey)?.status,
      EmailDeliveryStatus.FAILED,
    );
    assert.equal(requests, 1);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});

void test('unknown result is not retried after the idempotency window', async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousFetch = global.fetch;
  process.env.RESEND_API_KEY = 'test-key';
  let requests = 0;
  global.fetch = () => {
    requests += 1;
    return Promise.reject(new Error('Network timeout'));
  };
  try {
    const { service, input, records } = createHarness();
    assert.equal(await service.send(input), 'DEFERRED');
    const record = records.get(input.deliveryKey)!;
    record.firstAttemptAt = new Date(Date.now() - 24 * 60 * 60_000);
    record.nextAttemptAt = new Date(0);
    await service.sweepDue();
    assert.equal(record.status, EmailDeliveryStatus.REVIEW_REQUIRED);
    assert.equal(requests, 1);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousKey;
  }
});
