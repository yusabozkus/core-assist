-- CreateEnum
CREATE TYPE "QuestionAnswerStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "question_answer" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "status" "QuestionAnswerStatus" NOT NULL DEFAULT 'QUEUED',
    "externalAnswerId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingStartedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "question_answer_questionId_key" ON "question_answer"("questionId");

-- CreateIndex
CREATE INDEX "question_answer_storeId_status_queuedAt_idx" ON "question_answer"("storeId", "status", "queuedAt");

-- CreateIndex
CREATE INDEX "question_answer_connectionId_status_idx" ON "question_answer"("connectionId", "status");

-- AddForeignKey
ALTER TABLE "question_answer" ADD CONSTRAINT "question_answer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answer" ADD CONSTRAINT "question_answer_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "channel_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answer" ADD CONSTRAINT "question_answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "product_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_answer" ADD CONSTRAINT "question_answer_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
