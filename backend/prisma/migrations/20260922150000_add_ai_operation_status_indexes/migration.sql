CREATE INDEX "product_question_status_draftDecision_idx"
ON "product_question"("status", "draftDecision");

CREATE INDEX "product_question_status_draftProcessingStatus_idx"
ON "product_question"("status", "draftProcessingStatus");

CREATE INDEX "question_answer_status_updatedAt_idx"
ON "question_answer"("status", "updatedAt");
