import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../../database/prisma.service';
import { Prisma, ContactMessageTopic } from '../../generated/prisma/client';
import { TransactionLocks } from '../../../test/transaction-locks';
import { ContactService } from './contact.service';
import type { CreateContactMessageDto } from './dto/create-contact-message.dto';

type Contact = {
  id: string;
  emailNormalized: string;
  requestFingerprint: string;
  createdAt: Date;
};
type CountWhere = {
  emailNormalized?: string;
  requestFingerprint?: string;
  createdAt: { gte: Date };
};

function input(email = 'customer@example.test'): CreateContactMessageDto {
  return {
    name: 'Test Customer',
    email,
    topic: ContactMessageTopic.PRODUCT,
    subject: 'Product question',
    message: 'A local test message for the contact form.',
    sourcePage: '/contact',
  };
}

function fixture() {
  const rows: Contact[] = [];
  const locks = new TransactionLocks();
  const acquisitions: bigint[][] = [];
  let transactions = 0;
  let failInsert = false;
  const count = ({ where }: { where: CountWhere }) =>
    Promise.resolve(
      rows.filter(
        (row) =>
          row.createdAt >= where.createdAt.gte &&
          (!where.emailNormalized ||
            row.emailNormalized === where.emailNormalized) &&
          (!where.requestFingerprint ||
            row.requestFingerprint === where.requestFingerprint),
      ).length,
    );
  const prisma = {
    contactMessage: {
      count,
      create: ({ data }: { data: Contact }) => {
        const row = { ...data, id: randomUUID(), createdAt: new Date() };
        rows.push(row);
        return Promise.resolve({ id: row.id });
      },
    },
    $transaction: async <T>(
      action: (tx: unknown) => Promise<T>,
      options: { isolationLevel: string },
    ) => {
      transactions++;
      assert.equal(
        options.isolationLevel,
        Prisma.TransactionIsolationLevel.ReadCommitted,
      );
      return locks.run(async (lock) => {
        const pending: Contact[] = [];
        const acquired: bigint[] = [];
        acquisitions.push(acquired);
        const tx = {
          $executeRaw: async (parts: TemplateStringsArray, value: bigint) => {
            assert.match(parts.join('?'), /pg_advisory_xact_lock/);
            assert.equal(typeof value, 'bigint');
            await lock(value.toString());
            acquired.push(value);
            return 1;
          },
          contactMessage: {
            count: (args: { where: CountWhere }) => {
              assert.equal(
                acquired.length,
                2,
                'Both limits must be locked before counting',
              );
              return count(args);
            },
            create: ({ data }: { data: Contact }) => {
              const row = { ...data, id: randomUUID(), createdAt: new Date() };
              pending.push(row);
              if (failInsert) {
                failInsert = false;
                return Promise.reject(new Error('Insert failed'));
              }
              return Promise.resolve({ id: row.id });
            },
          },
        };
        const result = await action(tx);
        rows.push(...pending); // Commit before releasing any limit lock.
        return result;
      });
    },
  };
  return {
    rows,
    acquisitions,
    get transactions() {
      return transactions;
    },
    failNextInsert: () => {
      failInsert = true;
    },
    service: () => new ContactService(prisma as unknown as PrismaService),
  };
}

function assertRateLimited(result: PromiseSettledResult<unknown>) {
  assert.equal(result.status, 'rejected');
  if (result.status !== 'rejected') return;
  assert.ok(result.reason instanceof HttpException);
  assert.equal(result.reason.getStatus(), 429);
  assert.deepEqual(result.reason.getResponse(), {
    code: 'CONTACT_RATE_LIMITED',
    message:
      'Kısa süre içinde çok sayıda mesaj gönderdiniz. Lütfen daha sonra tekrar deneyin.',
    retryAfterSeconds: 3600,
  });
}

void test(
  '12 concurrent submissions from the same email accept only three across service instances',
  { timeout: 3000 },
  async () => {
    const f = fixture();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, index) =>
        f
          .service()
          .create(
            input(
              index % 2 ? 'CUSTOMER@example.test' : ' customer@example.test ',
            ),
            `192.0.2.${index + 1}`,
          ),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 3);
    results.filter((r) => r.status === 'rejected').forEach(assertRateLimited);
    assert.equal(f.rows.length, 3);
    assert.ok(
      f.rows.every((row) => row.emailNormalized === 'customer@example.test'),
    );
    for (const keys of f.acquisitions)
      assert.ok(keys[0] < keys[1], 'Lock order must be deterministic');
  },
);

void test(
  'one IP cannot exceed five per hour using different emails',
  { timeout: 3000 },
  async () => {
    const f = fixture();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, index) =>
        f
          .service()
          .create(input(`customer-${index}@example.test`), '192.0.2.1'),
      ),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5);
    results.filter((r) => r.status === 'rejected').forEach(assertRateLimited);
    assert.equal(f.rows.length, 5);
  },
);

void test(
  'a failed insert rolls back quota and releases both locks',
  { timeout: 3000 },
  async () => {
    const f = fixture();
    const service = f.service();
    await service.create(input(), '192.0.2.1');
    await service.create(input(), '192.0.2.1');
    f.failNextInsert();
    await assert.rejects(service.create(input(), '192.0.2.1'), /Insert failed/);
    assert.equal(f.rows.length, 2);
    assert.deepEqual(await service.create(input(), '192.0.2.1'), {
      accepted: true,
    });
    assert.equal(f.rows.length, 3);
    assertRateLimited(
      (await Promise.allSettled([service.create(input(), '192.0.2.1')]))[0],
    );
  },
);

void test('a rejected email does not consume the IP quota of an unrelated email', async () => {
  const f = fixture();
  const service = f.service();
  await Promise.all(
    [1, 2, 3].map((ip) => service.create(input(), `192.0.2.${ip}`)),
  );
  assertRateLimited(
    (await Promise.allSettled([service.create(input(), '198.51.100.1')]))[0],
  );
  const accepted = await Promise.all(
    Array.from({ length: 5 }, (_, index) =>
      service.create(input(`other-${index}@example.test`), '198.51.100.1'),
    ),
  );
  assert.equal(accepted.length, 5);
});

void test('old hourly records expire and honeypot submissions never touch persistence', async () => {
  const f = fixture();
  const service = f.service();
  await Promise.all(
    [1, 2, 3].map((ip) => service.create(input(), `192.0.2.${ip}`)),
  );
  for (const row of f.rows) row.createdAt = new Date(Date.now() - 2 * 3600_000);
  assert.deepEqual(await service.create(input(), '192.0.2.1'), {
    accepted: true,
  });
  const before = f.transactions;
  assert.deepEqual(
    await service.create({ ...input(), website: 'bot.example' }, '192.0.2.1'),
    { accepted: true },
  );
  assert.equal(f.transactions, before);
  assert.equal(f.rows.length, 4);
});
