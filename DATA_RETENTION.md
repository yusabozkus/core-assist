# Data Retention Policy

This policy limits the growth of operational database tables. A daily job in the BullMQ `data-retention` queue deletes up to 10,000 records of each type per run, in batches of 500.

## Default periods

| Record | Keep for | Delete when |
| --- | ---: | --- |
| Audit logs | 365 days | `createdAt` is older than the limit |
| Successful sync runs | 90 days | Status is `COMPLETED` and `updatedAt` is older than the limit |
| Failed sync runs | 180 days | Status is `FAILED` and `updatedAt` is older than the limit |
| Resolved support tickets | 365 days | Status is `RESOLVED` and `resolvedAt` is older than the limit |
| Closed support tickets | 365 days | Status is `CLOSED` and `closedAt` is older than the limit |
| Archived contact messages | 730 days | Status is `ARCHIVED` and `archivedAt` is older than the limit |

Deleting a support ticket also deletes its messages. Open tickets, tickets in progress, and tickets waiting for a customer reply are kept. Running sync jobs are also kept.

## Support images

Images use a private B2 bucket. The `support_image_object` table tracks each image separately from its account and ticket.

- Before upload, file keys are saved as `STAGED`. Uploads not attached to a message within one hour are cleaned up. Failed uploads or message operations have a five-minute wait, so an upload in progress can finish.
- A PostgreSQL trigger changes the image to `ATTACHED` in the same transaction as the message link. Expired files or files already claimed for cleanup cannot be attached.
- Deleting a ticket, message, or account marks its images `PENDING_DELETE` in the same transaction. A rollback also cancels this change. Retention cleanup checks the ticket status and date again before deletion, so reopened tickets are protected.
- A separate job in `data-retention` handles up to 20 files each minute. Each file has a two-minute lease. Another worker can take over after a crash. B2 errors retry after one minute, with waits increasing up to six hours. Failed records are kept until cleanup succeeds.
- New files include their B2 location. If the bucket or endpoint changes, cleanup waits instead of deleting from another location. Old images use the current `SUPPORT_B2_*` settings, as before. When moving storage, move both the files and their saved location.

Cleanup removes all versions and delete markers for the exact file key. It uses `VersionId` because a B2 delete without it only adds a delete marker. See [Backblaze delete behavior](https://www.backblaze.com/apidocs/s3-delete-object).

The key should have only `listFiles`, `readFiles`, `writeFiles`, and `deleteFiles` access for the support bucket. If Object Lock or missing permissions block deletion, keep the record for retry. Do not bypass the protection.

Migration `20261006120000_track_support_image_lifecycle` adds tracking for existing images and creates the triggers. It does not call B2. Pause image uploads, apply the migration, then start the new backend. Use migrations: `db push` does not create these triggers.

The migration cannot find old orphan files whose database records were already deleted. Review those with a separate bucket inventory. Bucket lifecycle rules can add protection, but must not delete attached images only because of their age.

## Billing operation records

A separate daily job in the billing queue uses these fixed periods:

| Record | Keep for | Delete when |
| --- | ---: | --- |
| Paddle webhook event IDs | 180 days | `processedAt` is older than the limit |
| Canceled or failed checkouts | 90 days | No subscription is linked and `updatedAt` is older than the limit |
| Expired plan previews | 1 extra day | Status is `PREVIEWED` and `expiresAt` has passed by one day |
| Failed plan changes | 90 days | Status is `FAILED` and `updatedAt` is older than the limit |
| Completed plan changes | 365 days | Status is `COMPLETED` and `updatedAt` is older than the limit |
| Paddle transaction references | 730 days | The last match's `updatedAt` is older than the limit |

Transaction references keep only the customer account, environment, and Paddle IDs for admin search. They do not keep card details, amounts, addresses, or raw webhooks.

## Email event records

Sync, channel, AI draft, and answer-delivery email incidents are deleted with their delivery records 90 days after the closing email is handled. Open incidents and pending closing emails are kept. The notification email queue runs this cleanup during its regular checks.

Resend delivery records keep the provider's acceptance ID and final send result. They are deleted 90 days after reaching a final state. Pending email content is kept only for safe retries. Content is removed after success, permanent failure, or a result that needs manual review. Uncertain sends are not retried automatically after Resend's idempotency window ends.

## Outside this policy

- This job does not delete invoices, payments, subscriptions, or usage accounting records. Billing operation records have separate rules.
- Products, questions, answers, and AI draft history are outside this policy.
- Set database backup retention separately with the infrastructure provider.

## Environment variables

Set retention periods in days with these variables:

- `DATA_RETENTION_AUDIT_LOG_DAYS`
- `DATA_RETENTION_COMPLETED_SYNC_RUN_DAYS`
- `DATA_RETENTION_FAILED_SYNC_RUN_DAYS`
- `DATA_RETENTION_RESOLVED_SUPPORT_TICKET_DAYS`
- `DATA_RETENTION_CLOSED_SUPPORT_TICKET_DAYS`
- `DATA_RETENTION_ARCHIVED_CONTACT_MESSAGE_DAYS`

`DATA_RETENTION_CLEANUP_INTERVAL_MS` sets the cleanup interval in milliseconds.

Before production, review these values and backup rules together with any legal or contract requirements.
