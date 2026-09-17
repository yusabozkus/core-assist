CREATE TYPE "AuditActorType" AS ENUM ('USER', 'ADMIN', 'SYSTEM');
CREATE TYPE "AuditOrigin" AS ENUM ('API', 'WORKER', 'WEBHOOK', 'SCHEDULED', 'SYSTEM');
CREATE TYPE "AuditResult" AS ENUM ('STARTED', 'SUCCESS', 'FAILURE');

CREATE TABLE "audit_log" (
  "id" TEXT NOT NULL,
  "actorType" "AuditActorType" NOT NULL,
  "actorUserId" TEXT,
  "origin" "AuditOrigin" NOT NULL,
  "action" TEXT NOT NULL,
  "result" "AuditResult" NOT NULL,
  "workspaceId" TEXT,
  "storeId" TEXT,
  "targetType" TEXT,
  "targetId" TEXT,
  "requestId" TEXT,
  "errorCode" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");
CREATE INDEX "audit_log_workspaceId_createdAt_idx"
  ON "audit_log"("workspaceId", "createdAt");
CREATE INDEX "audit_log_actorUserId_createdAt_idx"
  ON "audit_log"("actorUserId", "createdAt");
CREATE INDEX "audit_log_action_createdAt_idx"
  ON "audit_log"("action", "createdAt");
CREATE INDEX "audit_log_targetType_targetId_createdAt_idx"
  ON "audit_log"("targetType", "targetId", "createdAt");
CREATE INDEX "audit_log_result_createdAt_idx"
  ON "audit_log"("result", "createdAt");
