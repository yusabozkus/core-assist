CREATE TABLE "ai_draft_lease" (
    "workspaceId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_draft_lease_pkey" PRIMARY KEY ("workspaceId"),
    CONSTRAINT "ai_draft_lease_workspaceId_fkey" FOREIGN KEY ("workspaceId")
      REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
