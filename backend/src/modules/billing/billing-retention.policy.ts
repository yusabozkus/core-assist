const DAY_MS = 24 * 60 * 60 * 1_000;

export const BILLING_RETENTION_POLICY = {
  webhookEventDays: 180,
  abandonedCheckoutDays: 90,
  expiredPreviewGraceDays: 1,
  failedPlanChangeDays: 90,
  completedPlanChangeDays: 365,
} as const;

export function billingRetentionCutoff(now: Date, days: number) {
  return new Date(now.getTime() - days * DAY_MS);
}
