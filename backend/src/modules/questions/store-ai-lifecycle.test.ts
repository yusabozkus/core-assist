import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../database/prisma.service';
import type { BillingEntitlementService } from '../billing/billing-entitlement.service';
import type { AuditLogService } from '../audit/audit-log.service';
import type { BillingUsageService } from '../billing/billing-usage.service';
import type { BillingSubscriptionService } from '../billing/billing-subscription.service';
import type { BillingUsageNotificationService } from '../billing/billing-usage-notification.service';
import type { InventoryVerificationService } from '../inventory-verification/inventory-verification.service';
import type { QuestionProductLinkService } from '../question-product-link/question-product-link.service';
import type { AiDraftResult } from '../ai/ai-draft.types';
import { StoresService } from '../stores/stores.service';
import {
  analyzeProductQuestion,
  type ProductAnswerContextService,
} from './product-answer-context.service';
import { QuestionDraftService } from './question-draft.service';
import { QuestionReplyDecisionService } from './question-reply-decision.service';
import { QuestionResponsePolicyService } from './question-response-policy.service';
import {
  DraftExecutionService,
  DraftStoreInactiveException,
  DraftCapacityException,
} from './draft-execution.service';

// Only in-memory PostgreSQL is used. Model, billing access, audit delivery and
// notifications are local test doubles; no application connection is opened.
void test('store archive and AI draft lifecycle in isolated PostgreSQL', async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE "workspace" ("id" TEXT PRIMARY KEY, "units" INTEGER NOT NULL DEFAULT 0);
    INSERT INTO "workspace" ("id") VALUES ('workspace');
    CREATE TABLE "store" ("id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL REFERENCES "workspace",
      "status" TEXT NOT NULL DEFAULT 'ACTIVE', "name" TEXT NOT NULL DEFAULT 'Test store',
      "inventoryPolicy" TEXT NOT NULL DEFAULT 'SHARED');
    INSERT INTO "store" ("id", "workspaceId") VALUES ('store', 'workspace'), ('other-store', 'workspace');
    CREATE TABLE "product_question" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL REFERENCES "store",
      "status" TEXT NOT NULL DEFAULT 'PENDING', "question" TEXT NOT NULL DEFAULT 'Kumaşı nedir?',
      "answer" TEXT, "draftProcessingStatus" TEXT DEFAULT 'QUEUED', "draftProcessingError" TEXT,
      "draftQueuedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP, "draftProcessingStartedAt" TIMESTAMP);
    INSERT INTO "product_question" ("id", "storeId") VALUES
      ('question', 'store'), ('queued', 'store'), ('other-question', 'other-store');
    CREATE TABLE "draft_attempt" ("id" TEXT PRIMARY KEY, "storeId" TEXT NOT NULL, "questionId" TEXT NOT NULL,
      "answer" TEXT NOT NULL, "outcome" TEXT NOT NULL DEFAULT 'AVAILABLE');
  `);
  await db.exec(
    readFileSync(
      resolve(
        'prisma/migrations/20260927060000_add_ai_draft_lease/migration.sql',
      ),
      'utf8',
    ),
  );
  let busyDelivery = false;
  let failAudit = false;
  let modelCalls = 0;
  let quotaCalls = 0;
  let usageNotifications = 0;
  let onModel: (() => Promise<void>) | undefined;
  type StoreRow = {
    id: string;
    workspaceId: string;
    status: string;
    name: string;
    inventoryPolicy: string;
  };
  const sql = (parts: TemplateStringsArray) =>
    parts.reduce(
      (text, part, index) => text + (index ? `$${index}` : '') + part,
      '',
    );
  const adapter = (client: PGlite | Transaction) => ({
    $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) =>
      (await client.query(sql(parts), values)).rows,
    $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) =>
      (await client.query(sql(parts), values)).affectedRows,
    store: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        (
          await client.query<StoreRow>(
            'SELECT * FROM "store" WHERE "id" = $1',
            [where.id],
          )
        ).rows[0] ?? null,
      findFirst: async ({
        where,
      }: {
        where: { id: string; status: string };
      }) => {
        const store = (
          await client.query<StoreRow>(
            'SELECT * FROM "store" WHERE "id" = $1 AND "status" = $2',
            [where.id, where.status],
          )
        ).rows[0];
        return store
          ? {
              ...store,
              channelConnections: [],
              questionAnswers: busyDelivery ? [{ id: 'delivery' }] : [],
            }
          : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { status: string };
      }) =>
        (
          await client.query<StoreRow>(
            'UPDATE "store" SET "status" = $1 WHERE "id" = $2 RETURNING *',
            [data.status, where.id],
          )
        ).rows[0],
    },
    productQuestion: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; storeId: string };
      }) => {
        const question = (
          await client.query<{ id: string; question: string; status: string }>(
            'SELECT * FROM "product_question" WHERE "id" = $1 AND "storeId" = $2',
            [where.id, where.storeId],
          )
        ).rows[0];
        const store = (
          await client.query<StoreRow>(
            'SELECT * FROM "store" WHERE "id" = $1',
            [where.storeId],
          )
        ).rows[0];
        return question && store
          ? { ...question, store, answerDelivery: null }
          : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id?: string; storeId: string };
        data: { answer?: string; status?: string };
      }) => {
        const result = where.id
          ? await client.query(
              `UPDATE "product_question" SET "answer" = $1, "status" = $2,
              "draftProcessingStatus" = NULL, "draftProcessingError" = NULL, "draftQueuedAt" = NULL, "draftProcessingStartedAt" = NULL
              WHERE "id" = $3 AND "storeId" = $4 AND "status" IN ('PENDING', 'DRAFTED')`,
              [data.answer, data.status, where.id, where.storeId],
            )
          : await client.query(
              `UPDATE "product_question" SET "draftProcessingStatus" = NULL,
              "draftProcessingError" = NULL, "draftQueuedAt" = NULL, "draftProcessingStartedAt" = NULL
              WHERE "storeId" = $1 AND "draftProcessingStatus" IS NOT NULL`,
              [where.storeId],
            );
        return { count: result.affectedRows };
      },
    },
    aiDraftAttempt: {
      updateMany: async ({
        where,
      }: {
        where: { storeId: string; questionId: string };
      }) => {
        const result = await client.query(
          `UPDATE "draft_attempt" SET "outcome" = 'SUPERSEDED' WHERE "storeId" = $1 AND "questionId" = $2 AND "outcome" = 'AVAILABLE'`,
          [where.storeId, where.questionId],
        );
        return { count: result.affectedRows };
      },
      create: async ({
        data,
      }: {
        data: { storeId: string; questionId: string; answer: string };
      }) => {
        const id = randomUUID();
        await client.query(
          'INSERT INTO "draft_attempt" ("id", "storeId", "questionId", "answer") VALUES ($1, $2, $3, $4)',
          [id, data.storeId, data.questionId, data.answer],
        );
        return { id };
      },
    },
  });
  const prisma = {
    ...adapter(db),
    $transaction: <T>(work: (tx: Prisma.TransactionClient) => Promise<T>) =>
      db.transaction((tx) =>
        work(adapter(tx) as unknown as Prisma.TransactionClient),
      ),
  } as unknown as PrismaService;
  const stores = new StoresService(
    prisma,
    {
      assertStoreCapacityInTransaction: () => Promise.resolve(),
    } as unknown as BillingEntitlementService,
    {
      record: () =>
        failAudit
          ? Promise.reject(new Error('Audit failed'))
          : Promise.resolve(),
    } as unknown as AuditLogService,
  );
  const executions = new DraftExecutionService(prisma);
  const context = analyzeProductQuestion({
    questionId: 'question',
    question: 'Kumaşı nedir?',
    providerKey: 'trendyol',
    product: {
      id: 'product',
      title: 'Pamuklu tişört',
      description: null,
      brand: null,
      category: null,
      attributes: [{ name: 'Materyal', value: '%100 pamuk' }],
      variants: [],
    },
  });
  const draft: AiDraftResult = {
    answer: 'Ürün %100 pamuktur.',
    interpretation: 'Materyal sorusu',
    scope: 'IN_SCOPE',
    detectedFacts: ['MATERIAL'],
    answerability: 'FULL',
    decision: 'DRAFT',
    confidence: 1,
    usedFacts: ['MATERIAL'],
    usedEvidenceIds: context.evidence.map((item) => item.id),
    missingInformation: [],
    risks: [],
    source: 'GEMINI',
    model: 'local-mock',
  };
  const generation = new QuestionDraftService(
    prisma,
    {
      build: () => Promise.resolve(context),
    } as unknown as ProductAnswerContextService,
    {} as InventoryVerificationService,
    {
      generate: async () => {
        modelCalls++;
        await onModel?.();
        return draft;
      },
    },
    new QuestionResponsePolicyService(),
    new QuestionReplyDecisionService(),
    {
      linkQuestionIfPossible: () => Promise.resolve(),
    } as unknown as QuestionProductLinkService,
    {
      assertDraftGenerationAvailableForStore: () => Promise.resolve(),
      consumeSuccessfulDraft: async (tx: Prisma.TransactionClient) => {
        quotaCalls++;
        await tx.$executeRaw`UPDATE "workspace" SET "units" = "units" + 1 WHERE "id" = 'workspace'`;
        return { charged: true, used: 1, limit: 100, remaining: 99 };
      },
    } as unknown as BillingUsageService,
    {
      notifyAiQuestionThreshold: () => {
        usageNotifications++;
        return Promise.resolve();
      },
    } as unknown as BillingUsageNotificationService,
    {
      assertStoreAccess: () => Promise.resolve(),
    } as unknown as BillingSubscriptionService,
    executions,
  );
  const reset = async () => {
    busyDelivery = false;
    failAudit = false;
    modelCalls = 0;
    quotaCalls = 0;
    usageNotifications = 0;
    onModel = undefined;
    await db.exec(`DELETE FROM "ai_draft_lease"; DELETE FROM "draft_attempt";
      UPDATE "workspace" SET "units" = 0; UPDATE "store" SET "status" = 'ACTIVE';
      UPDATE "product_question" SET "status" = 'PENDING', "answer" = NULL, "draftProcessingStatus" = 'QUEUED',
        "draftProcessingError" = NULL, "draftQueuedAt" = CURRENT_TIMESTAMP, "draftProcessingStartedAt" = NULL;`);
  };
  const committed = async () => ({
    units: (
      await db.query<{ units: number }>('SELECT "units" FROM "workspace"')
    ).rows[0].units,
    drafts: (
      await db.query<{ count: number }>(
        'SELECT COUNT(*)::int AS count FROM "draft_attempt"',
      )
    ).rows[0].count,
  });

  await t.test(
    'an already archived store makes no model call and consumes no quota in either trigger',
    async () => {
      for (const trigger of ['MANUAL', 'AUTOMATION'] as const) {
        await reset();
        await stores.archive('store', 'user');
        await assert.rejects(
          generation.generate('store', 'question', { trigger }),
          DraftStoreInactiveException,
        );
        assert.equal(modelCalls, 0);
        assert.equal(quotaCalls, 0);
        assert.deepEqual(await committed(), { units: 0, drafts: 0 });
      }
    },
  );
  await t.test(
    'archiving during the model call prevents both the draft and quota commit',
    async () => {
      await reset();
      onModel = async () => {
        await stores.archive('store', 'user');
      };
      await assert.rejects(
        generation.generate('store', 'question'),
        DraftStoreInactiveException,
      );
      assert.equal(modelCalls, 1);
      assert.equal(quotaCalls, 0);
      assert.equal(usageNotifications, 0);
      assert.deepEqual(await committed(), { units: 0, drafts: 0 });
    },
  );
  await t.test(
    'archive and restore cannot revive the old model result',
    async () => {
      await reset();
      onModel = async () => {
        await stores.archive('store', 'user');
        await stores.restore('store', 'user');
      };
      await assert.rejects(
        generation.generate('store', 'question'),
        DraftCapacityException,
      );
      assert.deepEqual(await committed(), { units: 0, drafts: 0 });
      assert.equal(quotaCalls, 0);
    },
  );
  await t.test(
    'archiving clears only its pending markers and preserves another store in the same account',
    async () => {
      await reset();
      await db.exec(
        `UPDATE "product_question" SET "draftProcessingStatus" = 'PROCESSING', "draftProcessingStartedAt" = CURRENT_TIMESTAMP WHERE "id" = 'question'`,
      );
      await executions.run(
        'other-store',
        'other-question',
        async (execution) => {
          await stores.archive('store', 'user');
          await execution.assertActive();
          const rows = (
            await db.query<{
              id: string;
              draftProcessingStatus: string | null;
            }>(
              'SELECT "id", "draftProcessingStatus" FROM "product_question" ORDER BY "id"',
            )
          ).rows;
          assert.deepEqual(rows, [
            { id: 'other-question', draftProcessingStatus: 'QUEUED' },
            { id: 'question', draftProcessingStatus: null },
            { id: 'queued', draftProcessingStatus: null },
          ]);
        },
      );
    },
  );
  await t.test(
    'a failed archive rolls back store state, marker cancellation and lease revocation',
    async () => {
      await reset();
      await executions.run('store', 'question', async (execution) => {
        failAudit = true;
        await assert.rejects(stores.archive('store', 'user'), /Audit failed/);
        failAudit = false;
        await execution.assertActive();
        assert.equal(
          (await prisma.store.findUnique({ where: { id: 'store' } }))?.status,
          'ACTIVE',
        );
        assert.equal(
          (
            await db.query<{ draftProcessingStatus: string }>(
              'SELECT "draftProcessingStatus" FROM "product_question" WHERE "id" = $1',
              ['question'],
            )
          ).rows[0].draftProcessingStatus,
          'QUEUED',
        );
      });
    },
  );
  await t.test(
    'existing answer delivery protection still rejects archive without cancelling AI work',
    async () => {
      await reset();
      busyDelivery = true;
      await assert.rejects(
        stores.archive('store', 'user'),
        /tamamlanmadan mağaza arşivlenemez/,
      );
      assert.equal(
        (await prisma.store.findUnique({ where: { id: 'store' } }))?.status,
        'ACTIVE',
      );
      assert.equal(
        (
          await db.query<{ draftProcessingStatus: string }>(
            'SELECT "draftProcessingStatus" FROM "product_question" WHERE "id" = $1',
            ['question'],
          )
        ).rows[0].draftProcessingStatus,
        'QUEUED',
      );
    },
  );
  await t.test(
    'an active store still saves its draft and consumes quota exactly once',
    async () => {
      await reset();
      const result = await generation.generate('store', 'question');
      assert.equal(result.status, 'DRAFTED');
      assert.equal(modelCalls, 1);
      assert.equal(quotaCalls, 1);
      assert.equal(usageNotifications, 1);
      assert.deepEqual(await committed(), { units: 1, drafts: 1 });
    },
  );
});
