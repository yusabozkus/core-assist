ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

UPDATE "user" AS "user_record"
SET "onboardingCompletedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM "store_member" AS "store_member_record"
  INNER JOIN "channel_connection" AS "connection"
    ON "connection"."storeId" = "store_member_record"."storeId"
  INNER JOIN "catalog_sync_run" AS "sync_run"
    ON "sync_run"."connectionId" = "connection"."id"
  WHERE "store_member_record"."userId" = "user_record"."id"
    AND "connection"."status" = 'CONNECTED'
    AND "sync_run"."kind" = 'FULL'
    AND "sync_run"."status" IN ('RUNNING', 'COMPLETED')
);
