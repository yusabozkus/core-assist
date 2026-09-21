import type { Job, Queue, RepeatOptions } from 'bullmq';

const OVERDUE_GRACE_MS = 60_000;
const DELAYED_JOB_INSPECTION_LIMIT = 250;

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
