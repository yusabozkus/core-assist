const DAY_IN_MS = 24 * 60 * 60 * 1_000;

const DEFAULT_POLICY = {
  auditLogDays: 365,
  completedSyncRunDays: 90,
  failedSyncRunDays: 180,
  resolvedSupportTicketDays: 365,
  closedSupportTicketDays: 365,
  cleanupIntervalMs: DAY_IN_MS,
} as const;

export function resolveDataRetentionPolicy(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return {
    auditLogDays: readPositiveInteger(
      environment.DATA_RETENTION_AUDIT_LOG_DAYS,
      DEFAULT_POLICY.auditLogDays,
    ),
    completedSyncRunDays: readPositiveInteger(
      environment.DATA_RETENTION_COMPLETED_SYNC_RUN_DAYS,
      DEFAULT_POLICY.completedSyncRunDays,
    ),
    failedSyncRunDays: readPositiveInteger(
      environment.DATA_RETENTION_FAILED_SYNC_RUN_DAYS,
      DEFAULT_POLICY.failedSyncRunDays,
    ),
    resolvedSupportTicketDays: readPositiveInteger(
      environment.DATA_RETENTION_RESOLVED_SUPPORT_TICKET_DAYS,
      DEFAULT_POLICY.resolvedSupportTicketDays,
    ),
    closedSupportTicketDays: readPositiveInteger(
      environment.DATA_RETENTION_CLOSED_SUPPORT_TICKET_DAYS,
      DEFAULT_POLICY.closedSupportTicketDays,
    ),
    cleanupIntervalMs: readPositiveInteger(
      environment.DATA_RETENTION_CLEANUP_INTERVAL_MS,
      DEFAULT_POLICY.cleanupIntervalMs,
    ),
  };
}

export function dataRetentionCutoff(now: Date, days: number) {
  return new Date(now.getTime() - days * DAY_IN_MS);
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}
