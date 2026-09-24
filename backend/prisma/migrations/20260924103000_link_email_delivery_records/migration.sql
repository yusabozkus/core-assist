ALTER TABLE "email_delivery_record" ADD COLUMN "recipientUserId" TEXT;
ALTER TABLE "email_delivery_record" ADD COLUMN "storeId" TEXT;

CREATE INDEX "email_delivery_record_recipientUserId_createdAt_idx" ON "email_delivery_record"("recipientUserId", "createdAt");
CREATE INDEX "email_delivery_record_storeId_createdAt_idx" ON "email_delivery_record"("storeId", "createdAt");

ALTER TABLE "email_delivery_record" ADD CONSTRAINT "email_delivery_record_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_delivery_record" ADD CONSTRAINT "email_delivery_record_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
