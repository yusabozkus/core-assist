BEGIN;

-- Each account owns one internal workspace. Never merge or delete financial
-- records automatically if older data violates this invariant.
LOCK TABLE "workspace" IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT "ownerId" FROM "workspace"
    GROUP BY "ownerId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Multiple workspaces exist for the same owner. Resolve their store and billing records before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX "workspace_ownerId_key" ON "workspace"("ownerId");

COMMIT;
