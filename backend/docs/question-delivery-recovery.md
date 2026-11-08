# Question and Answer Delivery Recovery

This guide explains recovery for incoming questions and outgoing answers. The app does not use a confirmed provider idempotency contract for answer delivery. It does not automatically resend an answer when delivery is uncertain.

## Incoming questions

`IncomingEvent` records that an event arrived. If the same event arrives again but has no question, processing is tried again. PostgreSQL locks the event row. Creating the question and setting the event to `PROCESSED` happen in one transaction. Concurrent retries do not create a second question. If product matching fails, the event stays `FAILED` and can retry later.

Before fetching new provider pages, question sync checks the same connection's `PENDING` and `FAILED` events without questions, in batches of 100. Saved payloads pass through the existing Trendyol or Hepsiburada normalizer. This can recover a question even when it is no longer in the provider's current list. Subscription access and connection date checks still apply.

Missing or old mock payloads cannot be rebuilt safely. Wait for fresh provider data. Do not guess IDs, dates, text, or product details. If the connection or subscription is inactive, fix normal sync conditions first. A failed replay keeps the sync job failed; it is not hidden as a success.

## Outgoing answers

| Status | Behavior |
| --- | --- |
| `QUEUED` | PostgreSQL holds a saved send request. If the Redis job is missing, recovery creates it again with the same job ID. |
| `PROCESSING` | The worker has claimed the answer just before the provider POST. It must not POST the same record again. |
| `SENT` | A clear provider success and question/draft updates were saved in one transaction, or an operator verified delivery. |
| `FAILED` | Processing stopped before the external send, or an operator confirmed that it was not sent. The user can request a new send. |
| `REVIEW_REQUIRED` | Delivery is uncertain. The panel shows a delivery-review filter and warning. Admin AI usage lists delivery issues. New sends and drafts are blocked. |

Recovery runs through BullMQ every **60 seconds**. A `PROCESSING` record older than **15 minutes** moves to review. This prevents an endless sending status; it does not allow another provider POST. A live worker can still save a clear success as `SENT` for the same attempt.

Each new user attempt has a different job ID based on `queuedAt`. An old worker or final-error callback cannot send or change a newer attempt. Old jobs without attempt details finish without sending. Recovery queues the `QUEUED` record again with the correct details.

Temporary Redis loss does not remove the saved request. **A full Redis wipe also removes the scheduler.** After Redis recovers, restart the new backend. Startup creates the scheduler again and recovers database queue records. The app does not run global `FLUSHDB` or `FLUSHALL` commands.

## Moving from an older version

1. Back up the database. **Stop every old backend and answer worker instance.** Do not run old and new versions together. Old workers do not enforce the new delivery protection.
2. Run `npm run db:migrate:deploy` in the new backend. Keep the order of the two migrations: adding `REVIEW_REQUIRED`, then separating uncertain old attempts.
3. Old `PROCESSING` records and old `QUEUED`/`FAILED` records with `attempts > 0` move to review. Some may never have reached the provider because the old code increased the counter before sending. Automatic retries are still unsafe. Never-attempted queue records and `SENT` records are kept.
4. For a source installation, run `npm run db:generate` and `npm run build`. A Docker image that builds the app must also include these steps. Deploy the frontend with the new status label, then start only the new backend.
5. Check question sync, answer recovery, and review records in the panel. Do not roll back to old queue code without a recovery plan; it does not understand the new status.

During the original development work, migrations ran only on isolated test databases. That record does not confirm the state of your current database. Apply migrations with the stop/start order above.

## Resolve uncertain delivery

This is an operator maintenance command that needs database access, not a customer API. Customers can request a check through the support ticket page.

1. Find the answer ID in the admin delivery-issues API response or database. Match the answer text and marketplace question ID.
2. **Stop all backend and answer worker instances.** Pausing the queue alone does not stop a POST already in progress. `--workers-stopped` is the operator's statement; the command does not check other machines.
3. Check the provider's panel or records for proof that the answer was sent or not sent. An answer missing from the screen for a short time is not enough proof. If the result is still uncertain, leave it in review.
4. Run from the compiled new backend directory:

```powershell
# Delivery is confirmed. This does not send again.
npm run repair:answer -- <answer-id> sent "operator-name" "Verified question and delivery evidence" --workers-stopped

# No delivery is confirmed. This allows a new user request, but does not send.
npm run repair:answer -- <answer-id> not-sent "operator-name" "Evidence that the answer was not sent" --workers-stopped
```

The command changes only `REVIEW_REQUIRED` records. It locks the row and saves question/draft updates and the audit log in one transaction. For `sent`, the actual provider delivery time is unknown, so `sentAt` and `answeredAt` stay empty. Audit metadata keeps the verification time. `not-sent` does not enable automatic delivery again; the user must request a new send. Restart the new workers after the repair.

## Checks

In the backend directory:

```powershell
npm run check
```

The old answer-delivery integration test file is no longer in the source. `check` runs current local tests and the build, but does not prove end-to-end delivery or recovery. See [Quality checks](quality-checks.md).

In a live test environment, check event-processing failure, transaction rollback, concurrent replay, missing or uncertain Redis enqueue results, two workers, lost provider responses, database failure after sending, orphaned `PROCESSING` records, operator decisions and audit logs, and `SAFE_AUTO` rules. Also test real process crashes, server restarts, and marketplace sandbox delivery.
