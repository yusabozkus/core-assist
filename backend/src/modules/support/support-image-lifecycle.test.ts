import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

// No DATABASE_URL, TCP connection, Docker or B2 access. Execute the real
// migration, FK cascades and triggers in an ephemeral PostgreSQL instance.
void test('support image lifecycle migration in isolated PostgreSQL', async (t) => {
  const db = await PGlite.create();
  t.after(() => db.close());
  await db.exec(`
    CREATE TABLE "user" ("id" TEXT PRIMARY KEY);
    CREATE TABLE "workspace" (
      "id" TEXT PRIMARY KEY, "ownerId" TEXT REFERENCES "user"("id") ON DELETE CASCADE
    );
    CREATE TABLE "support_ticket" (
      "id" TEXT PRIMARY KEY,
      "workspaceId" TEXT REFERENCES "workspace"("id") ON DELETE CASCADE,
      "status" TEXT NOT NULL DEFAULT 'OPEN', "resolvedAt" TIMESTAMP(3)
    );
    CREATE TABLE "support_message" (
      "id" TEXT PRIMARY KEY, "ticketId" TEXT REFERENCES "support_ticket"("id") ON DELETE CASCADE
    );
  `);
  const migration = (name: string) =>
    readFileSync(
      resolve('prisma', 'migrations', name, 'migration.sql'),
      'utf8',
    );
  await db.exec(migration('20260928120000_add_support_attachments'));
  await db.exec(`
    INSERT INTO "user" VALUES ('legacy-owner');
    INSERT INTO "workspace" VALUES ('legacy-workspace', 'legacy-owner');
    INSERT INTO "support_ticket" ("id", "workspaceId") VALUES ('legacy-ticket', 'legacy-workspace');
    INSERT INTO "support_message" VALUES ('legacy-message', 'legacy-ticket');
    INSERT INTO "support_attachment" ("id", "messageId", "objectKey", "contentType", "size")
      VALUES ('legacy-image', 'legacy-message', 'support/legacy', 'image/png', 123);
  `);
  await db.exec(migration('20261006120000_track_support_image_lifecycle'));

  type Image = {
    objectKey: string;
    state: string;
    storageBucket: string | null;
    deleteAfter: Date | null;
  };
  const image = async (key: string) =>
    (
      await db.query<Image>(
        'SELECT * FROM "support_image_object" WHERE "objectKey" = $1',
        [key],
      )
    ).rows[0];
  const reset = () =>
    db.exec(`
    TRUNCATE "support_attachment", "support_message", "support_ticket", "workspace", "user", "support_image_object";
    INSERT INTO "user" VALUES ('owner');
    INSERT INTO "workspace" VALUES ('workspace', 'owner');
    INSERT INTO "support_ticket" ("id", "workspaceId") VALUES ('ticket', 'workspace');
    INSERT INTO "support_message" VALUES ('message', 'ticket');
  `);
  const stage = (key = 'support/test') =>
    db.query(
      `
    INSERT INTO "support_image_object" ("objectKey", "deleteAfter", "updatedAt", "storageBucket")
      VALUES ($1, CURRENT_TIMESTAMP + INTERVAL '1 hour', CURRENT_TIMESTAMP, 'test-bucket')
  `,
      [key],
    );
  const attach = (key = 'support/test', id = 'image') =>
    db.query(
      `
    INSERT INTO "support_attachment" ("id", "messageId", "objectKey", "contentType", "size")
      VALUES ($1, 'message', $2, 'image/png', 123)
  `,
      [id, key],
    );

  await t.test(
    'backfills existing images without changing messages or keys',
    async () => {
      assert.equal((await image('support/legacy')).state, 'ATTACHED');
      assert.equal((await image('support/legacy')).storageBucket, null);
      const rows = await db.query(
        'SELECT "objectKey" FROM "support_attachment"',
      );
      assert.deepEqual(rows.rows, [{ objectKey: 'support/legacy' }]);
    },
  );

  await t.test(
    'account cascade leaves durable cleanup work and preserves other accounts',
    async () => {
      await reset();
      await stage();
      await attach();
      await stage('support/internal');
      await attach('support/internal', 'internal-image');
      await db.exec(`
      INSERT INTO "user" VALUES ('other');
      INSERT INTO "workspace" VALUES ('other-workspace', 'other');
      INSERT INTO "support_ticket" ("id", "workspaceId") VALUES ('other-ticket', 'other-workspace');
      INSERT INTO "support_message" VALUES ('other-message', 'other-ticket');
    `);
      await stage('support/other');
      await db.exec(`INSERT INTO "support_attachment" ("id", "messageId", "objectKey", "contentType", "size")
      VALUES ('other-image', 'other-message', 'support/other', 'image/png', 123)`);
      await db.exec(`DELETE FROM "user" WHERE "id" = 'owner'`);
      assert.equal((await image('support/test')).state, 'PENDING_DELETE');
      assert.ok((await image('support/test')).deleteAfter);
      assert.equal((await image('support/internal')).state, 'PENDING_DELETE');
      assert.equal((await image('support/other')).state, 'ATTACHED');
      assert.equal(
        (await db.query('SELECT * FROM "support_attachment"')).rows.length,
        1,
      );
    },
  );

  await t.test(
    'a rolled-back account deletion keeps the images attached',
    async () => {
      await reset();
      await stage();
      await attach();
      await assert.rejects(
        db.transaction(async (tx) => {
          await tx.exec(`DELETE FROM "user" WHERE "id" = 'owner'`);
          throw new Error('Audit write failed');
        }),
        /Audit write failed/,
      );
      assert.equal((await image('support/test')).state, 'ATTACHED');
      assert.equal(
        (await db.query('SELECT * FROM "support_attachment"')).rows.length,
        1,
      );
    },
  );

  await t.test(
    'reopening between selection and deletion preserves the ticket and images',
    async () => {
      await reset();
      await stage();
      await attach();
      await db.exec(
        `UPDATE "support_ticket" SET "status" = 'RESOLVED', "resolvedAt" = '2020-01-01'`,
      );
      const selected = await db.query<{ id: string }>(
        `SELECT "id" FROM "support_ticket" WHERE "status" = 'RESOLVED'`,
      );
      await db.exec(
        `UPDATE "support_ticket" SET "status" = 'OPEN', "resolvedAt" = NULL`,
      );
      const deleted = await db.query(
        `DELETE FROM "support_ticket"
      WHERE "id" = $1 AND "status" = 'RESOLVED' AND "resolvedAt" < '2025-01-01'`,
        [selected.rows[0].id],
      );
      assert.equal(deleted.affectedRows, 0);
      assert.equal((await image('support/test')).state, 'ATTACHED');
      assert.equal(
        (await db.query('SELECT * FROM "support_attachment"')).rows.length,
        1,
      );
    },
  );

  await t.test(
    'retention deletion queues the exact attachment keys',
    async () => {
      await reset();
      await stage();
      await attach();
      await db.exec(`DELETE FROM "support_ticket" WHERE "id" = 'ticket'`);
      assert.equal((await image('support/test')).state, 'PENDING_DELETE');
      assert.equal(
        (await db.query('SELECT * FROM "support_attachment"')).rows.length,
        0,
      );
    },
  );

  await t.test(
    'a failed message transaction rolls back attachment registration',
    async () => {
      await reset();
      await stage();
      await assert.rejects(
        db.transaction(async (tx) => {
          await tx.exec(`INSERT INTO "support_attachment" ("id", "messageId", "objectKey", "contentType", "size")
        VALUES ('image', 'message', 'support/test', 'image/png', 123)`);
          throw new Error('Notification write failed');
        }),
        /Notification write failed/,
      );
      assert.equal((await image('support/test')).state, 'STAGED');
      assert.equal(
        (await db.query('SELECT * FROM "support_attachment"')).rows.length,
        0,
      );
    },
  );

  await t.test(
    'expired uploads and claimed cleanup objects cannot be attached',
    async () => {
      await reset();
      await stage();
      await db.exec(
        `UPDATE "support_image_object" SET "deleteAfter" = CURRENT_TIMESTAMP - INTERVAL '1 second'`,
      );
      await assert.rejects(attach(), /expired or is not available/);
      await db.exec(`UPDATE "support_image_object" SET "state" = 'PENDING_DELETE', "claimToken" = 'worker',
      "claimUntil" = CURRENT_TIMESTAMP + INTERVAL '2 minutes'`);
      await assert.rejects(attach(), /expired or is not available/);
      assert.equal(
        (await db.query('SELECT * FROM "support_attachment"')).rows.length,
        0,
      );
    },
  );

  await t.test(
    'attaching first prevents cleanup from claiming the same object',
    async () => {
      await reset();
      await stage();
      await attach();
      const claim =
        await db.query(`UPDATE "support_image_object" SET "state" = 'PENDING_DELETE'
      WHERE "objectKey" = 'support/test' AND "state" IN ('STAGED', 'PENDING_DELETE')`);
      assert.equal(claim.affectedRows, 0);
      await assert.rejects(
        db.exec(
          `DELETE FROM "support_image_object" WHERE "objectKey" = 'support/test'`,
        ),
        /foreign key constraint/,
      );
    },
  );

  await t.test(
    'object keys cannot be replaced without cleaning up the original object',
    async () => {
      await reset();
      await stage();
      await attach();
      await stage('support/replacement');
      await assert.rejects(
        db.exec(
          `UPDATE "support_attachment" SET "objectKey" = 'support/replacement'`,
        ),
        /immutable/,
      );
      assert.equal((await image('support/test')).state, 'ATTACHED');
      assert.equal((await image('support/replacement')).state, 'STAGED');
    },
  );
});
