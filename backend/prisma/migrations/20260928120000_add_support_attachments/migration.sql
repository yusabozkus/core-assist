CREATE TABLE "support_attachment" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_attachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_attachment_objectKey_key" ON "support_attachment"("objectKey");
CREATE INDEX "support_attachment_messageId_idx" ON "support_attachment"("messageId");

ALTER TABLE "support_attachment"
  ADD CONSTRAINT "support_attachment_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "support_message"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
