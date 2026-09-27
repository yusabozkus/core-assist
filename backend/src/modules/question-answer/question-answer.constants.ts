export const QUESTION_ANSWER_QUEUE = 'question-answer';
export const SEND_QUESTION_ANSWER_JOB = 'SEND_QUESTION_ANSWER';
export const RECONCILE_QUESTION_ANSWERS_JOB = 'RECONCILE_QUESTION_ANSWERS';
export const ANSWER_RECONCILE_INTERVAL_MS = 60_000;
export const ANSWER_PROCESSING_TIMEOUT_MS = 15 * 60_000;
export const ANSWER_DELIVERY_REVIEW_MESSAGE =
  'Cevabın pazaryerine ulaşıp ulaşmadığı doğrulanamadı. Mükerrer cevap oluşmaması için tekrar gönderim durduruldu. Pazaryerindeki cevabı kontrol ederek destek ekibine bildirin.';
export const QUESTION_ANSWER_DISPATCHER = Symbol('QUESTION_ANSWER_DISPATCHER');
