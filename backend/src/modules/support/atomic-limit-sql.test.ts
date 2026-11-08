import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import type { PrismaService } from '../../database/prisma.service';
import { Prisma, ContactMessageTopic } from '../../generated/prisma/client';
import { ContactService } from '../contact/contact.service';
import { lockSupportTicketForImages } from './support-ticket-lock';

// Verify the actual SQL in ephemeral PostgreSQL, not development PostgreSQL.
// PGlite has one connection: concurrent contention is covered separately by
// transaction-lock fixtures; this checks SQL, parameter binding and rollback.
void test('atomic limit SQL and transaction lifetime in isolated PostgreSQL', async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE "contact_message" (
      "id" TEXT PRIMARY KEY, "name" TEXT, "email" TEXT, "emailNormalized" TEXT,
      "company" TEXT, "topic" TEXT, "subject" TEXT, "message" TEXT,
      "sourcePage" TEXT, "requestFingerprint" TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "user" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "workspace" ("id" TEXT PRIMARY KEY, "ownerId" TEXT REFERENCES "user");
    CREATE TABLE "support_ticket" (
      "id" TEXT PRIMARY KEY, "workspaceId" TEXT REFERENCES "workspace", "number" INTEGER,
      "subject" TEXT, "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, "status" TEXT DEFAULT 'OPEN',
      "firstRespondedAt" TIMESTAMPTZ, "resolvedAt" TIMESTAMPTZ, "closedAt" TIMESTAMPTZ,
      "assignedAdminUserId" TEXT, "storeId" TEXT, "createdByUserId" TEXT
    );
    INSERT INTO "user" VALUES ('customer'), ('admin'), ('other-customer');
    INSERT INTO "workspace" VALUES ('workspace', 'customer'), ('other-workspace', 'other-customer');
    INSERT INTO "support_ticket" ("id", "workspaceId", "number", "createdByUserId") VALUES ('ticket', 'workspace', 1, 'customer');
  `);
  let failInsert = false;
  const sql = (parts: TemplateStringsArray) =>
    parts.reduce(
      (text, part, index) => text + (index ? `$${index}` : '') + part,
      '',
    );
  const adapter = (client: PGlite | Transaction) => ({
    $executeRaw: async (parts: TemplateStringsArray, ...values: unknown[]) =>
      (
        await client.query(
          sql(parts),
          values.map((value) =>
            typeof value === 'bigint' ? value.toString() : value,
          ),
        )
      ).affectedRows,
    $queryRaw: async (
      parts: TemplateStringsArray | Prisma.Sql,
      ...values: unknown[]
    ) =>
      (
        await client.query(
          'text' in parts ? parts.text : sql(parts),
          'text' in parts ? parts.values : values,
        )
      ).rows,
    contactMessage: {
      count: async ({
        where,
      }: {
        where: {
          emailNormalized?: string;
          requestFingerprint?: string;
          createdAt: { gte: Date };
        };
      }) => {
        const field = where.emailNormalized
          ? 'emailNormalized'
          : 'requestFingerprint';
        return (
          await client.query<{ count: number }>(
            `SELECT COUNT(*)::int AS "count" FROM "contact_message" WHERE "${field}" = $1 AND "createdAt" >= $2`,
            [where[field], where.createdAt.gte],
          )
        ).rows[0].count;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (failInsert) {
          failInsert = false;
          throw new Error('Insert failed');
        }
        return (
          await client.query<{ id: string }>(
            `
          INSERT INTO "contact_message" ("id", "name", "email", "emailNormalized", "company", "topic",
            "subject", "message", "sourcePage", "requestFingerprint")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING "id"
        `,
            [
              randomUUID(),
              data.name,
              data.email,
              data.emailNormalized,
              data.company,
              data.topic,
              data.subject,
              data.message,
              data.sourcePage,
              data.requestFingerprint,
            ],
          )
        ).rows[0];
      },
    },
  });
  const prisma = {
    ...adapter(db),
    $transaction: <T>(
      action: (tx: unknown) => Promise<T>,
      options: { isolationLevel: string },
    ) =>
      db.transaction(async (tx) => {
        assert.equal(options.isolationLevel, 'ReadCommitted');
        await tx.exec('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        return action(adapter(tx));
      }),
  } as unknown as PrismaService;
  const service = new ContactService(prisma);
  const input = {
    name: 'Test customer',
    email: 'test@example.test',
    topic: ContactMessageTopic.PRODUCT,
    subject: 'Test subject',
    message: 'A local SQL test message.',
  };

  await t.test(
    'advisory locks accept signed bigint parameters and disappear at commit and rollback',
    async () => {
      await service.create(input, '192.0.2.1');
      failInsert = true;
      await assert.rejects(service.create(input, '192.0.2.1'), /Insert failed/);
      await service.create(input, '192.0.2.1');
      await service.create(input, '192.0.2.1');
      await assert.rejects(
        service.create(input, '192.0.2.1'),
        /çok sayıda mesaj/,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            'SELECT COUNT(*)::int AS "count" FROM "contact_message"',
          )
        ).rows[0].count,
        3,
      );
      assert.equal(
        (
          await db.query<{ count: number }>(
            "SELECT COUNT(*)::int AS count FROM pg_locks WHERE locktype = 'advisory'",
          )
        ).rows[0].count,
        0,
      );
    },
  );

  await t.test(
    'workspace-before-ticket lock SQL scopes customer access and returns fresh ticket state',
    async () =>
      db.transaction(async (client) => {
        const tx = adapter(client) as unknown as Prisma.TransactionClient;
        const ticket = await lockSupportTicketForImages(
          tx,
          'ticket',
          'customer',
          'workspace',
        );
        assert.equal(ticket.workspaceId, 'workspace');
        assert.equal(ticket.status, 'OPEN');
        await client.exec(
          `UPDATE "support_ticket" SET "status" = 'CLOSED' WHERE "id" = 'ticket'`,
        );
        assert.equal(
          (await lockSupportTicketForImages(tx, 'ticket', 'admin')).status,
          'CLOSED',
        );
        await assert.rejects(
          lockSupportTicketForImages(
            tx,
            'ticket',
            'customer',
            'other-workspace',
          ),
          /Destek talebi bulunamadı/,
        );
        await assert.rejects(
          lockSupportTicketForImages(tx, 'missing', 'customer'),
          /Destek talebi bulunamadı/,
        );
      }),
  );
});
