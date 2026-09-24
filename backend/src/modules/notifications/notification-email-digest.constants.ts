export const NOTIFICATION_EMAIL_DIGEST_QUEUE = 'notification-email-digest';
export const SEND_AI_REVIEW_DIGEST_JOB = 'send-ai-review-digest';
export const AI_REVIEW_DIGEST_INTERVAL_MS = 8 * 60 * 60_000;
export const SEND_LOW_STOCK_DIGEST_JOB = 'send-low-stock-digest';
export const SEND_OUT_OF_STOCK_DIGEST_JOB = 'send-out-of-stock-digest';
export const LOW_STOCK_DIGEST_CHECK_INTERVAL_MS = 60 * 60_000;
export const OUT_OF_STOCK_DIGEST_CHECK_INTERVAL_MS = 15 * 60_000;
export const LOW_STOCK_DIGEST_MIN_GAP_MS = 24 * 60 * 60_000;
export const OUT_OF_STOCK_COALESCE_MS = 15 * 60_000;
export const LOW_STOCK_COALESCE_MS = 5 * 60_000;
export const SEND_SYNC_INCIDENT_EMAIL_JOB = 'send-sync-incident-email';
export const SWEEP_SYNC_INCIDENT_EMAILS_JOB = 'sweep-sync-incident-emails';
export const SYNC_INCIDENT_SWEEP_INTERVAL_MS = 5 * 60_000;
export const SEND_OPERATIONAL_INCIDENT_EMAIL_JOB =
  'send-operational-incident-email';
export const SWEEP_OPERATIONAL_INCIDENT_EMAILS_JOB =
  'sweep-operational-incident-emails';
export const SWEEP_EMAIL_DELIVERIES_JOB = 'sweep-email-deliveries';
export const EMAIL_DELIVERY_SWEEP_INTERVAL_MS = 60_000;
