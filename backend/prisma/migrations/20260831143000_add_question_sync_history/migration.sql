-- AlterEnum
ALTER TYPE "CatalogSyncKind" ADD VALUE 'QUESTION';

-- AlterTable
ALTER TABLE "catalog_sync_run"
ADD COLUMN "questionsProcessed" INTEGER NOT NULL DEFAULT 0;
