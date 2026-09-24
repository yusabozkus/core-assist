export const OPERATIONAL_EMAIL_SUMMARY_INTERVAL_MS = 8 * 60 * 60_000;
export const OPERATIONAL_EMAIL_RECOVERY_WINDOW_MS = 5 * 60_000;
export const OPERATIONAL_EMAIL_SWEEP_INTERVAL_MS = 5 * 60_000;

export function operationalSummaryDue(
  failureCount: number,
  lastEmailedFailureCount: number,
  lastEmailAt: Date | null,
  now: Date,
) {
  return (
    lastEmailAt !== null &&
    failureCount > lastEmailedFailureCount &&
    now.getTime() - lastEmailAt.getTime() >=
      OPERATIONAL_EMAIL_SUMMARY_INTERVAL_MS
  );
}

export function operationalRecoveryDue(
  candidateAt: Date | null,
  lastFailureAt: Date,
  now: Date,
) {
  return (
    candidateAt !== null &&
    candidateAt.getTime() >= lastFailureAt.getTime() &&
    now.getTime() - candidateAt.getTime() >=
      OPERATIONAL_EMAIL_RECOVERY_WINDOW_MS
  );
}
