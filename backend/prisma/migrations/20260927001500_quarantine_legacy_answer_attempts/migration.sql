-- The old worker claimed before validation and could retry an accepted POST.
-- Existing attempts therefore cannot prove non-delivery. Stop old workers
-- before this migration and verify these rows through the review procedure.
-- Kept separate from ADD VALUE so the enum value is committed before use.
UPDATE "question_answer"
SET "status" = 'REVIEW_REQUIRED',
    "lastError" = 'Önceki sürümde başlayan gönderimin sonucu doğrulanmalıdır. Pazaryerindeki cevabı kontrol ederek destek ekibine bildirin.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'PROCESSING'
   OR ("status" IN ('QUEUED', 'FAILED') AND "attempts" > 0);
