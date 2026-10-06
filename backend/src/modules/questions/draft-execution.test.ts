import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { PrismaService } from '../../database/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  DraftCapacityException,
  DraftExecutionService,
  type DraftExecution,
} from './draft-execution.service';

void test('draft lease acquisition and abandoned processing recovery in isolated PostgreSQL', async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`CREATE TABLE "workspace" ("id" TEXT PRIMARY KEY);
    INSERT INTO "workspace" VALUES ('workspace');
    CREATE TABLE "store" ("id" TEXT PRIMARY KEY, "status" TEXT NOT NULL DEFAULT 'ACTIVE');
    INSERT INTO "store" ("id") VALUES ('store');
    CREATE TABLE "product_question" ("id" TEXT PRIMARY KEY, "status" TEXT NOT NULL DEFAULT 'PROCESSING');
    INSERT INTO "product_question" VALUES ('question', 'PROCESSING');`);
  await db.exec(
    readFileSync(
      resolve(
        'prisma/migrations/20260927060000_add_ai_draft_lease/migration.sql',
      ),
      'utf8',
    ),
  );
  const raw =
    (client: PGlite | Transaction, transactionStartedAt?: Date) =>
    async (parts: TemplateStringsArray, ...values: unknown[]) => {
      let sql = parts.reduce(
        (statement, part, index) =>
          statement + (index ? `$${index}` : '') + part,
        '',
      );
      if (transactionStartedAt && sql.includes('CURRENT_TIMESTAMP')) {
        // PGlite serializes transactions on one connection. Supply the frozen
        // timestamp of a transaction that was waiting on recovery's row lock.
        sql = sql.replaceAll(
          'CURRENT_TIMESTAMP',
          `$${values.length + 1}::timestamptz`,
        );
        values.push(transactionStartedAt);
      }
      return (await client.query(sql, values)).rows;
    };
  const execute =
    (client: PGlite | Transaction) =>
    async (parts: TemplateStringsArray, ...values: unknown[]) =>
      (
        await client.query(
          parts.reduce(
            (sql, part, index) => sql + (index ? `$${index}` : '') + part,
            '',
          ),
          values,
        )
      ).affectedRows;
  const prisma = {
    productQuestion: {
      findFirst: () =>
        Promise.resolve({
          store: { workspaceId: 'workspace', status: 'ACTIVE' },
        }),
    },
    store: {
      findUnique: async () =>
        (await db.query<{ status: string }>('SELECT "status" FROM "store"'))
          .rows[0],
    },
    $queryRaw: raw(db),
    $executeRaw: execute(db),
    $transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
      db.transaction((tx) =>
        work({
          $queryRaw: raw(tx),
          $executeRaw: execute(tx),
        } as unknown as Prisma.TransactionClient),
      ),
  } as unknown as PrismaService;
  const service = new DraftExecutionService(prisma);
  const restore = (tx: Prisma.TransactionClient) =>
    tx.$executeRaw`UPDATE "product_question" SET "status" = 'QUEUED' WHERE "id" = 'question'`.then(
      (count) => count === 1,
    );
  const reset = () =>
    db.exec(
      `DELETE FROM "ai_draft_lease"; UPDATE "product_question" SET "status" = 'PROCESSING';`,
    );
  const state = async () =>
    (
      await db.query<{ status: string }>(
        'SELECT "status" FROM "product_question"',
      )
    ).rows[0].status;

  await t.test(
    'live ownership prevents recovery even if Redis lost the job',
    async () => {
      await reset();
      await service.run('store', 'question', async (execution) => {
        assert.equal(
          await service.recoverAbandonedProcessing(
            'workspace',
            'question',
            restore,
          ),
          false,
        );
        assert.equal(await state(), 'PROCESSING');
        await execution.assertActive();
      });
    },
  );

  await t.test('missing and expired leases permit recovery', async () => {
    await reset();
    assert.equal(
      await service.recoverAbandonedProcessing(
        'workspace',
        'question',
        restore,
      ),
      true,
    );
    assert.equal(await state(), 'QUEUED');
    await reset();
    await db.exec(
      `INSERT INTO "ai_draft_lease" VALUES ('workspace', 'question', 'dead-worker', CURRENT_TIMESTAMP - INTERVAL '1 second', CURRENT_TIMESTAMP - INTERVAL '1 hour')`,
    );
    assert.equal(
      await service.recoverAbandonedProcessing(
        'workspace',
        'question',
        restore,
      ),
      true,
    );
  });

  await t.test(
    "recovery never releases another question's valid lease",
    async () => {
      await reset();
      await service.run('store', 'other-question', async (execution) => {
        assert.equal(
          await service.recoverAbandonedProcessing(
            'workspace',
            'question',
            restore,
          ),
          true,
        );
        await execution.assertActive();
        const lease = await db.query<{ questionId: string }>(
          'SELECT "questionId" FROM "ai_draft_lease"',
        );
        assert.equal(lease.rows[0].questionId, 'other-question');
      });
    },
  );

  await t.test('two competing executions cannot both generate', async () => {
    await reset();
    await service.run('store', 'question', async () => {
      let secondWorkCalled = false;
      await assert.rejects(
        service.run('store', 'question', () => {
          secondWorkCalled = true;
          return Promise.resolve();
        }),
        DraftCapacityException,
      );
      assert.equal(secondWorkCalled, false);
    });
  });

  await t.test(
    'the expired worker cannot commit or release a newer owner',
    async () => {
      await reset();
      let oldExecution: DraftExecution | undefined;
      let newExecution: DraftExecution | undefined;
      let finishNew!: () => void;
      let newReady!: () => void;
      const ready = new Promise<void>((resolve) => {
        newReady = resolve;
      });
      const newGate = new Promise<void>((resolve) => {
        finishNew = resolve;
      });
      let runningNew: Promise<void> | undefined;
      await service.run('store', 'question', async (execution) => {
        oldExecution = execution;
        await db.exec(
          `UPDATE "ai_draft_lease" SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 second', "startedAt" = CURRENT_TIMESTAMP - INTERVAL '1 hour'`,
        );
        assert.equal(
          await service.recoverAbandonedProcessing(
            'workspace',
            'question',
            restore,
          ),
          true,
        );
        runningNew = service.run('store', 'question', async (next) => {
          newExecution = next;
          newReady();
          await newGate;
        });
        await ready;
        await assert.rejects(
          oldExecution.assertActive(),
          DraftCapacityException,
        );
      });
      try {
        await newExecution!.assertActive();
      } finally {
        finishNew();
      }
      await runningNew;
    },
  );

  await t.test(
    'recovery fences a late transaction that began before lease expiry',
    async () => {
      await reset();
      await service.run('store', 'question', async (execution) => {
        const startedBeforeExpiry = new Date(Date.now() - 60_000);
        await db.exec(
          `UPDATE "ai_draft_lease" SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 second'`,
        );
        assert.equal(
          await service.recoverAbandonedProcessing(
            'workspace',
            'question',
            restore,
          ),
          true,
        );
        const lateTransaction = {
          $queryRaw: raw(db, startedBeforeExpiry),
        } as unknown as Prisma.TransactionClient;
        await assert.rejects(
          execution.assertActive(lateTransaction),
          DraftCapacityException,
        );
        assert.equal(await state(), 'QUEUED');
      });
    },
  );

  await t.test('a failed restoration rolls back its state change', async () => {
    await reset();
    await assert.rejects(
      service.recoverAbandonedProcessing(
        'workspace',
        'question',
        async (tx) => {
          await restore(tx);
          throw new Error('Restore failed');
        },
      ),
      /Restore failed/,
    );
    assert.equal(await state(), 'PROCESSING');
  });
});
