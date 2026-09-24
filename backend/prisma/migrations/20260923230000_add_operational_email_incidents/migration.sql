CREATE TYPE "OperationalEmailIncidentKind" AS ENUM ('AI_DRAFT', 'ANSWER_DELIVERY');
CREATE TYPE "OperationalEmailIncidentStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "OperationalEmailPhase" AS ENUM ('OPEN', 'SUMMARY', 'RESOLVED');

CREATE TABLE "operational_email_incident" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "connectionId" TEXT,
  "scopeKey" TEXT NOT NULL,
  "kind" "OperationalEmailIncidentKind" NOT NULL,
  "status" "OperationalEmailIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "failureCount" INTEGER NOT NULL DEFAULT 1,
  "lastEmailedFailureCount" INTEGER NOT NULL DEFAULT 0,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastFailureAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recoveryCandidateAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "openedEmailAt" TIMESTAMP(3),
  "lastEmailAt" TIMESTAMP(3),
  "resolvedEmailAt" TIMESTAMP(3),
  "claimToken" TEXT,
  "claimUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operational_email_incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "operational_email_delivery" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "phase" "OperationalEmailPhase" NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "SyncEmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "claimToken" TEXT,
  "claimUntil" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "operational_email_delivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operational_email_incident_storeId_kind_scopeKey_status_idx" ON "operational_email_incident"("storeId", "kind", "scopeKey", "status");
CREATE INDEX "operational_email_incident_status_openedAt_idx" ON "operational_email_incident"("status", "openedAt");
CREATE INDEX "operational_email_incident_status_recoveryCandidateAt_idx" ON "operational_email_incident"("status", "recoveryCandidateAt");
CREATE UNIQUE INDEX "operational_email_incident_open_key" ON "operational_email_incident"("storeId", "kind", "scopeKey") WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "operational_email_delivery_incidentId_recipientUserId_phase_sequence_key" ON "operational_email_delivery"("incidentId", "recipientUserId", "phase", "sequence");
CREATE INDEX "operational_email_delivery_status_claimUntil_idx" ON "operational_email_delivery"("status", "claimUntil");

ALTER TABLE "operational_email_incident" ADD CONSTRAINT "operational_email_incident_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_email_delivery" ADD CONSTRAINT "operational_email_delivery_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "operational_email_incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_email_delivery" ADD CONSTRAINT "operational_email_delivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
