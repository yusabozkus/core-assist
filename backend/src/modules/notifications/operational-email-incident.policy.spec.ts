import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  OPERATIONAL_EMAIL_RECOVERY_WINDOW_MS,
  OPERATIONAL_EMAIL_SUMMARY_INTERVAL_MS,
  operationalRecoveryDue,
  operationalSummaryDue,
} from './operational-email-incident.policy';

void test('yeni hata olmadan veya sekiz saat dolmadan özet maili gönderilmez', () => {
  const now = new Date('2026-09-23T20:00:00.000Z');
  const lastEmailAt = new Date(
    now.getTime() - OPERATIONAL_EMAIL_SUMMARY_INTERVAL_MS,
  );
  assert.equal(operationalSummaryDue(1, 1, lastEmailAt, now), false);
  assert.equal(operationalSummaryDue(2, 1, null, now), false);
  assert.equal(
    operationalSummaryDue(2, 1, new Date(lastEmailAt.getTime() + 1), now),
    false,
  );
  assert.equal(operationalSummaryDue(2, 1, lastEmailAt, now), true);
});

void test('iyileşme ancak son hatadan sonra sessiz dönem geçtiyse kesinleşir', () => {
  const lastFailureAt = new Date('2026-09-23T20:00:00.000Z');
  const candidateAt = new Date(lastFailureAt.getTime() + 1_000);
  assert.equal(
    operationalRecoveryDue(
      candidateAt,
      lastFailureAt,
      new Date(
        candidateAt.getTime() + OPERATIONAL_EMAIL_RECOVERY_WINDOW_MS - 1,
      ),
    ),
    false,
  );
  assert.equal(
    operationalRecoveryDue(
      candidateAt,
      lastFailureAt,
      new Date(candidateAt.getTime() + OPERATIONAL_EMAIL_RECOVERY_WINDOW_MS),
    ),
    true,
  );
  assert.equal(
    operationalRecoveryDue(
      new Date(lastFailureAt.getTime() - 1),
      lastFailureAt,
      new Date(candidateAt.getTime() + OPERATIONAL_EMAIL_RECOVERY_WINDOW_MS),
    ),
    false,
  );
});
