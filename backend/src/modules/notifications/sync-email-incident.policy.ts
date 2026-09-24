import { SyncEmailIncidentKind } from '../../generated/prisma/enums';

export const SYNC_FAILURE_EMAIL_THRESHOLD = 3;
export const SYNC_FAILURE_EMAIL_DELAY_MS = 15 * 60_000;

export function syncIncidentEmailDue(
  kind: SyncEmailIncidentKind,
  failureCount: number,
  openedAt: Date,
  now: Date,
) {
  return (
    kind === SyncEmailIncidentKind.AUTH ||
    failureCount >= SYNC_FAILURE_EMAIL_THRESHOLD ||
    now.getTime() - openedAt.getTime() >= SYNC_FAILURE_EMAIL_DELAY_MS
  );
}
