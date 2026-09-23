import type { Job, Queue, RepeatOptions } from 'bullmq';

const OVERDUE_GRACE_MS = 60_000;
const DELAYED_JOB_INSPECTION_LIMIT = 250;
const ACTIVE_JOB_INSPECTION_LIMIT = 100;
const RECENT_FAILURE_SCAN_BATCH = 500;

export type QueueRuntimeThresholds = {
  waitingAgeWarningMs: number;
  activeDurationWarningMs: number;
  activeStallWarningMs: number;
};

const DEFAULT_RUNTIME_THRESHOLDS: QueueRuntimeThresholds = {
  waitingAgeWarningMs: 10 * 60_000,
  activeDurationWarningMs: 15 * 60_000,
  activeStallWarningMs: 5 * 60_000,
};

const QUEUE_RUNTIME_THRESHOLDS: Record<string, QueueRuntimeThresholds> = {
  'product-sync': {
    waitingAgeWarningMs: 10 * 60_000,
    activeDurationWarningMs: 30 * 60_000,
    activeStallWarningMs: 5 * 60_000,
  },
  'question-sync': {
    waitingAgeWarningMs: 5 * 60_000,
    activeDurationWarningMs: 15 * 60_000,
    activeStallWarningMs: 3 * 60_000,
  },
  'question-draft': {
    waitingAgeWarningMs: 10 * 60_000,
    activeDurationWarningMs: 10 * 60_000,
    activeStallWarningMs: 2 * 60_000,
  },
  'question-answer': {
    waitingAgeWarningMs: 5 * 60_000,
    activeDurationWarningMs: 5 * 60_000,
    activeStallWarningMs: 60_000,
  },
  'size-guide': {
    waitingAgeWarningMs: 10 * 60_000,
    activeDurationWarningMs: 15 * 60_000,
    activeStallWarningMs: 3 * 60_000,
  },
  'paddle-webhooks': {
    waitingAgeWarningMs: 2 * 60_000,
    activeDurationWarningMs: 2 * 60_000,
    activeStallWarningMs: 60_000,
  },
  'billing-recovery': {
    waitingAgeWarningMs: 10 * 60_000,
    activeDurationWarningMs: 15 * 60_000,
    activeStallWarningMs: 3 * 60_000,
  },
  'support-notifications': {
    waitingAgeWarningMs: 2 * 60_000,
    activeDurationWarningMs: 5 * 60_000,
    activeStallWarningMs: 60_000,
  },
  'notification-email-digest': {
    waitingAgeWarningMs: 5 * 60_000,
    activeDurationWarningMs: 15 * 60_000,
    activeStallWarningMs: 3 * 60_000,
  },
  'data-retention': {
    waitingAgeWarningMs: 60 * 60_000,
    activeDurationWarningMs: 60 * 60_000,
    activeStallWarningMs: 10 * 60_000,
  },
};

const activeProgressObservations = new Map<
  string,
  { signature: string; lastChangedAt: number }
>();

export function getQueueRuntimeThresholds(queueKey: string) {
  return QUEUE_RUNTIME_THRESHOLDS[queueKey] ?? DEFAULT_RUNTIME_THRESHOLDS;
}

export async function inspectQueueRuntime(
  queue: Queue,
  queueKey: string,
  now = Date.now(),
) {
  const thresholds = getQueueRuntimeThresholds(queueKey);
  const [workerCount, waitingJobs, activeJobs] = await Promise.all([
    queue.getWorkersCount().catch(() => null),
    queue.getJobs(['waiting'], 0, 0, true),
    queue.getJobs(['active'], 0, ACTIVE_JOB_INSPECTION_LIMIT - 1, true),
  ]);
  const oldestWaitingAt = minimumTimestamp(
    waitingJobs.map((job) => job.processedOn ?? job.timestamp),
  );
  const oldestActiveAt = minimumTimestamp(
    activeJobs.map((job) => job.processedOn ?? job.timestamp),
  );
  const oldestWaitingAgeMs = ageMs(oldestWaitingAt, now);
  const longestActiveAgeMs = ageMs(oldestActiveAt, now);
  const activeProgress = observeActiveProgress(
    queueKey,
    activeJobs,
    thresholds,
    now,
  );

  return {
    workerCount,
    workerUnavailable: workerCount === 0,
    oldestWaitingAgeMs,
    longestActiveAgeMs,
    waitingAgeWarningMs: thresholds.waitingAgeWarningMs,
    activeDurationWarningMs: thresholds.activeDurationWarningMs,
    activeStallWarningMs: thresholds.activeStallWarningMs,
    waitingAgeExceeded:
      oldestWaitingAgeMs !== null &&
      oldestWaitingAgeMs >= thresholds.waitingAgeWarningMs,
    activeDurationExceeded: activeProgress.stalledActiveJobs > 0,
    stalledActiveJobs: activeProgress.stalledActiveJobs,
  };
}

export async function countRecentQueueFailures(
  queue: Queue,
  failedSince: number,
) {
  const client = await queue.getBackend().connection.client;
  const failedKey = queue.toKey('failed');
  let start = 0;
  let count = 0;

  while (true) {
    const entries = await client.zrevrange(
      failedKey,
      start,
      start + RECENT_FAILURE_SCAN_BATCH - 1,
      { WITHSCORES: true },
    );
    if (entries.length === 0) return count;

    for (let index = 1; index < entries.length; index += 2) {
      const score = Number(entries[index]);
      if (!Number.isFinite(score) || score < failedSince) return count;
      count += 1;
    }

    if (entries.length < RECENT_FAILURE_SCAN_BATCH * 2) return count;
    start += RECENT_FAILURE_SCAN_BATCH;
  }
}

export async function inspectScheduledJobs(queue: Queue, now = Date.now()) {
  const jobs = await queue.getJobs(
    ['delayed'],
    0,
    DELAYED_JOB_INSPECTION_LIMIT - 1,
    true,
  );
  const scheduledJobs = jobs.map((job) => toScheduledJob(job, now));

  return {
    overdue: scheduledJobs.filter((job) => job.overdue).length,
    jobs: scheduledJobs,
  };
}

function toScheduledJob(job: Job, now: number) {
  const scheduledFor = job.timestamp + Math.max(0, job.delay);
  const repeat = (job.opts as typeof job.opts & { repeat?: RepeatOptions })
    .repeat;
  const kind =
    job.repeatJobKey || repeat
      ? ('RECURRING' as const)
      : job.attemptsMade > 0
        ? ('RETRY' as const)
        : ('DELAYED' as const);
  const overdueByMs = Math.max(0, now - scheduledFor);

  return {
    id: String(job.id ?? 'unknown'),
    name: job.name,
    kind,
    createdAt: new Date(job.timestamp),
    scheduledFor: new Date(scheduledFor),
    overdue: overdueByMs > OVERDUE_GRACE_MS,
    overdueByMs,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? 0,
    recurrence: repeat
      ? {
          everyMs: repeat.every ?? null,
          pattern: repeat.pattern ?? null,
          timezone: repeat.tz ?? null,
        }
      : null,
  };
}

function minimumTimestamp(values: number[]) {
  if (values.length === 0) return null;
  return Math.min(...values);
}

function ageMs(timestamp: number | null, now: number) {
  return timestamp === null ? null : Math.max(0, now - timestamp);
}

function observeActiveProgress(
  queueKey: string,
  jobs: Job[],
  thresholds: QueueRuntimeThresholds,
  now: number,
) {
  const prefix = `${queueKey}:`;
  const seen = new Set<string>();
  let stalledActiveJobs = 0;

  for (const job of jobs) {
    const observationKey = `${prefix}${String(job.id ?? 'unknown')}`;
    const signature = progressSignature(job.progress);
    const existing = activeProgressObservations.get(observationKey);
    const observation =
      !existing || existing.signature !== signature
        ? { signature, lastChangedAt: now }
        : existing;
    activeProgressObservations.set(observationKey, observation);
    seen.add(observationKey);

    const activeAge = ageMs(job.processedOn ?? job.timestamp, now) ?? 0;
    const unchangedFor = now - observation.lastChangedAt;
    if (
      activeAge >= thresholds.activeDurationWarningMs &&
      unchangedFor >= thresholds.activeStallWarningMs
    ) {
      stalledActiveJobs += 1;
    }
  }

  for (const key of activeProgressObservations.keys()) {
    if (key.startsWith(prefix) && !seen.has(key)) {
      activeProgressObservations.delete(key);
    }
  }

  return { stalledActiveJobs };
}

function progressSignature(progress: Job['progress']) {
  if (typeof progress === 'number' || typeof progress === 'string') {
    return String(progress);
  }
  try {
    return JSON.stringify(progress) ?? '[undefined]';
  } catch {
    return '[unserializable]';
  }
}
