ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_ANNOUNCEMENT';

CREATE TABLE "admin_announcement" (
  "id" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "message" VARCHAR(1000) NOT NULL,
  "roles" TEXT[] NOT NULL,
  "sendEmail" BOOLEAN NOT NULL DEFAULT false,
  "audienceHash" VARCHAR(64) NOT NULL,
  "recipientCount" INTEGER NOT NULL,
  "emailCount" INTEGER NOT NULL,
  "skippedEmailCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "admin_announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "admin_announcement_publishedAt_idx" ON "admin_announcement"("publishedAt");
CREATE INDEX "admin_announcement_createdById_createdAt_idx" ON "admin_announcement"("createdById", "createdAt");
