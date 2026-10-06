BEGIN;

CREATE TYPE "SupportImageObjectState" AS ENUM ('STAGED', 'ATTACHED', 'PENDING_DELETE');

CREATE TABLE "support_image_object" (
  "objectKey" TEXT NOT NULL,
  "state" "SupportImageObjectState" NOT NULL DEFAULT 'STAGED',
  "storageEndpoint" TEXT,
  "storageRegion" TEXT,
  "storageBucket" TEXT,
  "deleteAfter" TIMESTAMP(3),
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "claimToken" TEXT,
  "claimUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_image_object_pkey" PRIMARY KEY ("objectKey")
);

CREATE INDEX "support_image_object_state_deleteAfter_claimUntil_idx"
  ON "support_image_object"("state", "deleteAfter", "claimUntil");

-- Existing objects belong to the currently configured bucket. New uploads
-- snapshot their bucket/endpoint so a config change cannot delete other data.
-- Lock out concurrent attachment inserts until backfill + triggers are ready.
LOCK TABLE "support_attachment" IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO "support_image_object" ("objectKey", "state", "createdAt", "updatedAt")
  SELECT "objectKey", 'ATTACHED', "createdAt", CURRENT_TIMESTAMP
  FROM "support_attachment";

ALTER TABLE "support_attachment" ADD CONSTRAINT "support_attachment_objectKey_fkey"
  FOREIGN KEY ("objectKey") REFERENCES "support_image_object"("objectKey")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Link and cleanup claims serialize on the same object row. An expired or
-- already claimed upload must never become an attachment while B2 deletes it.
CREATE FUNCTION "attach_support_image_object"() RETURNS TRIGGER AS $$
BEGIN
  UPDATE "support_image_object"
    SET "state" = 'ATTACHED', "deleteAfter" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "objectKey" = NEW."objectKey"
      AND "state" = 'STAGED'
      AND "deleteAfter" > clock_timestamp()
      AND "claimToken" IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support image upload expired or is not available'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "support_attachment_register_object"
  BEFORE INSERT ON "support_attachment"
  FOR EACH ROW EXECUTE FUNCTION "attach_support_image_object"();

CREATE FUNCTION "preserve_support_image_object_key"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."objectKey" IS DISTINCT FROM OLD."objectKey" THEN
    RAISE EXCEPTION 'Support image object keys are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "support_attachment_preserve_object_key"
  BEFORE UPDATE OF "objectKey" ON "support_attachment"
  FOR EACH ROW EXECUTE FUNCTION "preserve_support_image_object_key"();

-- Runs inside the deleting transaction, including user/workspace cascades.
-- A rollback rolls this back too; B2 is only touched by the cleanup worker.
CREATE FUNCTION "queue_support_image_deletion"() RETURNS TRIGGER AS $$
BEGIN
  UPDATE "support_image_object"
    SET "state" = 'PENDING_DELETE', "deleteAfter" = CURRENT_TIMESTAMP,
        "attemptCount" = 0, "lastError" = NULL, "claimToken" = NULL,
        "claimUntil" = NULL, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "objectKey" = OLD."objectKey";
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "support_attachment_queue_deletion"
  AFTER DELETE ON "support_attachment"
  FOR EACH ROW EXECUTE FUNCTION "queue_support_image_deletion"();

COMMIT;
