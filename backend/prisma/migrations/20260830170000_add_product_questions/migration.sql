-- CreateEnum
CREATE TYPE "IncomingEventType" AS ENUM ('PRODUCT_QUESTION');

-- CreateEnum
CREATE TYPE "IncomingEventProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductQuestionStatus" AS ENUM ('PENDING', 'DRAFTED', 'ANSWERED', 'IGNORED');

-- AlterTable
ALTER TABLE "channel_connection"
ADD COLUMN "questionSyncStartedAt" TIMESTAMP(3),
ADD COLUMN "lastQuestionSyncAt" TIMESTAMP(3),
ADD COLUMN "questionSyncFailureReason" TEXT;

-- CreateTable
CREATE TABLE "incoming_event" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" "IncomingEventType" NOT NULL,
    "externalCreatedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStatus" "IncomingEventProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "ignoreReason" TEXT,
    "errorMessage" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incoming_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_question" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "incomingEventId" TEXT NOT NULL,
    "productId" TEXT,
    "externalProductRecordId" TEXT,
    "externalQuestionId" TEXT NOT NULL,
    "externalProductId" TEXT NOT NULL,
    "externalCustomerId" TEXT,
    "customerName" TEXT,
    "question" TEXT NOT NULL,
    "status" "ProductQuestionStatus" NOT NULL DEFAULT 'PENDING',
    "answer" TEXT,
    "externalCreatedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "incoming_event_connectionId_externalEventId_key" ON "incoming_event"("connectionId", "externalEventId");

-- CreateIndex
CREATE INDEX "incoming_event_storeId_processingStatus_receivedAt_idx" ON "incoming_event"("storeId", "processingStatus", "receivedAt");

-- CreateIndex
CREATE INDEX "incoming_event_connectionId_externalCreatedAt_idx" ON "incoming_event"("connectionId", "externalCreatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "product_question_incomingEventId_key" ON "product_question"("incomingEventId");

-- CreateIndex
CREATE UNIQUE INDEX "product_question_connectionId_externalQuestionId_key" ON "product_question"("connectionId", "externalQuestionId");

-- CreateIndex
CREATE INDEX "product_question_storeId_status_externalCreatedAt_idx" ON "product_question"("storeId", "status", "externalCreatedAt");

-- CreateIndex
CREATE INDEX "product_question_productId_idx" ON "product_question"("productId");

-- CreateIndex
CREATE INDEX "product_question_externalProductRecordId_idx" ON "product_question"("externalProductRecordId");

-- AddForeignKey
ALTER TABLE "incoming_event" ADD CONSTRAINT "incoming_event_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incoming_event" ADD CONSTRAINT "incoming_event_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "channel_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_question" ADD CONSTRAINT "product_question_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_question" ADD CONSTRAINT "product_question_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "channel_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_question" ADD CONSTRAINT "product_question_incomingEventId_fkey" FOREIGN KEY ("incomingEventId") REFERENCES "incoming_event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_question" ADD CONSTRAINT "product_question_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_question" ADD CONSTRAINT "product_question_externalProductRecordId_fkey" FOREIGN KEY ("externalProductRecordId") REFERENCES "external_product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
