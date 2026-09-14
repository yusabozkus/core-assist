CREATE TYPE "WorkspaceInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- Core Asistan exposes one workspace per account. Enforcing it in PostgreSQL
-- also closes the race where two invitations are accepted simultaneously.
CREATE UNIQUE INDEX "workspace_member_userId_key" ON "workspace_member"("userId");

CREATE TABLE "workspace_invitation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "status" "WorkspaceInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workspace_invitation_store_access" (
    "invitationId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "role" "StoreRole" NOT NULL DEFAULT 'AGENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_invitation_store_access_pkey" PRIMARY KEY ("invitationId", "storeId")
);

CREATE UNIQUE INDEX "workspace_invitation_tokenHash_key"
ON "workspace_invitation"("tokenHash");

CREATE UNIQUE INDEX "workspace_invitation_workspace_pending_email_key"
ON "workspace_invitation"("workspaceId", "emailNormalized")
WHERE "status" = 'PENDING';

CREATE INDEX "workspace_invitation_workspaceId_status_expiresAt_idx"
ON "workspace_invitation"("workspaceId", "status", "expiresAt");

CREATE INDEX "workspace_invitation_emailNormalized_status_idx"
ON "workspace_invitation"("emailNormalized", "status");

CREATE INDEX "workspace_invitation_store_access_storeId_idx"
ON "workspace_invitation_store_access"("storeId");

ALTER TABLE "workspace_invitation"
ADD CONSTRAINT "workspace_invitation_workspaceId_fkey"
FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitation"
ADD CONSTRAINT "workspace_invitation_invitedByUserId_fkey"
FOREIGN KEY ("invitedByUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workspace_invitation_store_access"
ADD CONSTRAINT "workspace_invitation_store_access_invitationId_fkey"
FOREIGN KEY ("invitationId") REFERENCES "workspace_invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitation_store_access"
ADD CONSTRAINT "workspace_invitation_store_access_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Workspace-level owners and administrators must be able to reach every
-- existing store. Future stores are covered by StoresService.
INSERT INTO "store_member" ("id", "storeId", "userId", "role", "createdAt", "updatedAt")
SELECT
    'workspace-manager:' || wm."id" || ':' || store."id",
    store."id",
    wm."userId",
    CASE WHEN wm."role" = 'OWNER' THEN 'OWNER'::"StoreRole" ELSE 'ADMIN'::"StoreRole" END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "workspace_member" wm
INNER JOIN "store" store ON store."workspaceId" = wm."workspaceId"
WHERE wm."role" IN ('OWNER', 'ADMIN')
ON CONFLICT ("storeId", "userId") DO NOTHING;
