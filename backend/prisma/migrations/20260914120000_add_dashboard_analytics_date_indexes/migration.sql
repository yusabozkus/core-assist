CREATE INDEX "product_question_storeId_externalCreatedAt_idx"
ON "product_question"("storeId", "externalCreatedAt");

CREATE INDEX "product_question_storeId_answeredAt_idx"
ON "product_question"("storeId", "answeredAt");

CREATE INDEX "ai_draft_attempt_storeId_createdAt_idx"
ON "ai_draft_attempt"("storeId", "createdAt");

CREATE INDEX "question_answer_storeId_status_sentAt_idx"
ON "question_answer"("storeId", "status", "sentAt");
