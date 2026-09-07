-- CreateTable
CREATE TABLE "notification_preference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_userId_storeId_type_key"
ON "notification_preference"("userId", "storeId", "type");

-- CreateIndex
CREATE INDEX "notification_preference_storeId_type_idx"
ON "notification_preference"("storeId", "type");

-- AddForeignKey
ALTER TABLE "notification_preference"
ADD CONSTRAINT "notification_preference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference"
ADD CONSTRAINT "notification_preference_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "store"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

