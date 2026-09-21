const FAILED_JOB_RETENTION_DAYS = 7;
const SECONDS_PER_DAY = 24 * 60 * 60;

export function failedJobRetention(count: number) {
  return {
    age: FAILED_JOB_RETENTION_DAYS * SECONDS_PER_DAY,
    count,
  };
}
