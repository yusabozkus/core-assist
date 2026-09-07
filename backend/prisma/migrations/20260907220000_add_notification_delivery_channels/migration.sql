-- CreateTable
CREATE TABLE "notification_delivery_setting" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "browserEnabled" BOOLEAN NOT NULL DEFAULT false,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
  "quietHoursEnd" TEXT NOT NULL DEFAULT '08:00',
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "notification_delivery_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_push_subscription" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "web_push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_delivery_setting_userId_storeId_key"
ON "notification_delivery_setting"("userId", "storeId");

-- CreateIndex
CREATE INDEX "notification_delivery_setting_storeId_idx"
ON "notification_delivery_setting"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "web_push_subscription_endpoint_key"
ON "web_push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "web_push_subscription_userId_idx"
ON "web_push_subscription"("userId");

-- AddForeignKey
ALTER TABLE "notification_delivery_setting"
ADD CONSTRAINT "notification_delivery_setting_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_setting"
ADD CONSTRAINT "notification_delivery_setting_storeId_fkey"
FOREIGN KEY ("storeId") REFERENCES "store"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_push_subscription"
ADD CONSTRAINT "web_push_subscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
