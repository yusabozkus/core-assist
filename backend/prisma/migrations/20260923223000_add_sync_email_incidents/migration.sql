CREATE TYPE "SyncEmailIncidentKind" AS ENUM ('FULL', 'INVENTORY', 'QUESTION', 'AUTH');
CREATE TYPE "SyncEmailIncidentStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "SyncEmailDeliveryPhase" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "SyncEmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED');

CREATE TABLE "sync_email_incident" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "kind" "SyncEmailIncidentKind" NOT NULL,
  "status" "SyncEmailIncidentStatus" NOT NULL DEFAULT 'OPEN',
  "failureCount" INTEGER NOT NULL DEFAULT 1,
  "lastRunId" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastFailureAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "openEmailCompletedAt" TIMESTAMP(3),
  "resolvedEmailCompletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_email_incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sync_email_incident_delivery" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "phase" "SyncEmailDeliveryPhase" NOT NULL,
  "status" "SyncEmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "claimToken" TEXT,
  "claimUntil" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sync_email_incident_delivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_email_incident_connectionId_kind_status_idx" ON "sync_email_incident"("connectionId", "kind", "status");
CREATE INDEX "sync_email_incident_status_openedAt_idx" ON "sync_email_incident"("status", "openedAt");
CREATE UNIQUE INDEX "sync_email_incident_delivery_incidentId_recipientUserId_phase_key" ON "sync_email_incident_delivery"("incidentId", "recipientUserId", "phase");
CREATE INDEX "sync_email_incident_delivery_status_claimUntil_idx" ON "sync_email_incident_delivery"("status", "claimUntil");

ALTER TABLE "sync_email_incident" ADD CONSTRAINT "sync_email_incident_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "channel_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_email_incident_delivery" ADD CONSTRAINT "sync_email_incident_delivery_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "sync_email_incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_email_incident_delivery" ADD CONSTRAINT "sync_email_incident_delivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
