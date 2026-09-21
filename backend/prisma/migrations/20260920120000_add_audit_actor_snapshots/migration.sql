ALTER TABLE "audit_log"
ADD COLUMN "actorName" TEXT,
ADD COLUMN "actorEmail" TEXT;

-- Preserve the identity shown for existing audit entries before switching
-- reads away from the mutable user table.
UPDATE "audit_log" AS "audit"
SET
  "actorName" = "actor"."name",
  "actorEmail" = "actor"."email"
FROM "user" AS "actor"
WHERE "audit"."actorUserId" = "actor"."id"
  AND (
    "audit"."actorName" IS NULL
    OR "audit"."actorEmail" IS NULL
  );
