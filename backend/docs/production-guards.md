# Push, AI Draft, and Log Protection

This guide explains push validation, AI draft limits, and invitation log protection. See [Quality checks](quality-checks.md) for current automated coverage and checks that need real browsers and HTTPS.

## Push subscriptions

The app checks endpoints and keys at registration and before every send. It rejects protocols other than HTTPS, ports other than 443, user credentials in URLs, fragments, IP addresses, and domains that copy an allowed service name. `p256dh` must be a valid P-256 public key. `auth` must be 16 bytes of base64url data.

Allowed hosts:

- `fcm.googleapis.com` — [Chrome push service](https://developer.chrome.com/blog/push-notifications-on-the-open-web).
- `updates.push.services.mozilla.com` — [Mozilla Autopush](https://mozilla-services.github.io/autopush-rs/http.html).
- `*.push.apple.com`, with one subdomain — [WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
- `*.notify.windows.com`, with one subdomain — [Microsoft push service addresses](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/firewall-allowlist-config).

Endpoint paths are provider values that the app does not interpret. The WNS root path with a query is also accepted. Before adding another host, check an endpoint created by a real browser, then update the list and tests. Do not allow a general wildcard.

DNS checks run inside the HTTPS socket resolver. If any returned address is private, loopback, link-local, or in a blocked reserved range, the send is rejected. The socket uses the checked addresses directly, without another DNS lookup. TLS certificate checks remain enabled. Redirects and proxies are not followed.

The total timeout is 10 seconds, including DNS, connection, and response. The response body limit is 64 KiB. `web-push` encryption and VAPID still apply. The existing process removes subscriptions after `404` or `410` responses.

Each user can have at most **10 subscriptions**. A user-row lock protects concurrent registration. Existing subscriptions can be updated, but another user's subscription cannot be taken over. On a shared browser, remove the old subscription before changing accounts. Invalid old records are rejected during sending; no deletion migration is run. Send queries also return at most 10 subscriptions per user.

## AI draft generation

Manual and automatic generation share a PostgreSQL `ai_draft_lease` record. There can be **one generation at a time per account/workspace**, with **at least five seconds between starts**. Stores in the same account share this limit. Separate accounts do not block each other. This prevents duplicate generation and races for the last quota allowance.

When capacity is busy, manual requests return `429`, `AI_RATE_LIMITED`, and `retryAfterSeconds: 5`. The panel uses its normal waiting behavior. Automatic jobs wait five seconds without using a failed-attempt allowance. This limit is separate from the AI provider's rate limit.

The lease lasts five minutes and renews every 30 seconds. Renewal stops after 10 minutes of generation. This is not an exact 10-minute cancellation: the lease may remain until its last renewal expires. Normal completion or failure releases it. After a crash, another job can take over an expired lease. An old token cannot release a newer job.

Ownership is checked before the external AI call and again inside the draft/quota transaction, with a row lock. Failed generation or lost ownership does not save a draft or use customer quota. A late draft is also blocked if answer delivery was queued during generation. Existing free regeneration rules stay the same.

**The cost of a request already sent to the provider cannot be reversed.** A crashed process does not prove that its external call stopped. Stock validation can also require two model calls within one logical generation. These rules are not a fixed money budget.

### Archived stores

Archiving changes a store to `INACTIVE`. An active subscription does not allow AI work for that store. Workers skip pending draft and prepared-answer jobs before model or answer calls. New draft queue records require an active store. The archive transaction clears draft job markers, but keeps answers and draft history.

In the same transaction, archive changes the token only for that store's running generation. Reopening immediately cannot save the old model result. Another store's generation in the same workspace and the account cooldown are kept. If archive or audit writing fails, the store status, markers, and token change all roll back.

Manual and automatic generation check store status in the shared lease process. They check again before stock/model calls. Draft and quota saving locks the same store row used by archive:

- If archive finishes first, no draft, attempt, or quota record is saved.
- If draft saving finishes first, the valid result from before archive is kept.
- Cancellation due to archive creates no AI error or quota warning.
- A late external result may still cost the provider, but does not use customer quota.

This uses existing store and `ai_draft_lease` tables. No new migration or environment setting is needed for archive protection. Use current backend and worker versions; old workers do not apply these checks.

### Interrupted draft jobs

Every **five minutes**, the draft recovery scheduler also scans `PENDING` questions with `PROCESSING` draft records older than **six minutes**. Age alone does not allow another generation. The record is kept if the BullMQ job is waiting, active, or delayed, or the same question has a valid PostgreSQL lease. An unreadable Redis state also does not start a new generation. Old records without a start time use their queue time, then their last update time.

For missing, completed, failed, or orphaned Redis jobs, lease changes and recovery use the same workspace-row lock. The transaction checks the attempt, store, connection, automation, and answer-delivery state again. An eligible job becomes `QUEUED` in the database before it is added with the same BullMQ ID. If enqueue fails, the saved request stays for the next scan.

Saved `KNOWLEDGE_RESOLVED` intent keeps the requesting user's details. If this intent is lost in Redis and automation is off, recovery does not assume a manual request.

Quota or subscription blocks save the matching waiting status. An orphaned job becomes `FAILED` with a reason if the store is archived, the connection is lost, the product is unmatched, automation is off, or answer delivery has started or is uncertain. Recovery does not call the model or marketplace directly. The normal worker repeats its checks before generation.

Worker error and capacity-delay callbacks can update only their own attempt, matched by start and queue times. Old callbacks cannot change a recovered or newer job. Recovery also changes the same question's expired lease token. Even an old transaction waiting on a row lock cannot commit afterward. A valid lease for another question is kept.

**This process never resends an answer in `PROCESSING`.** Use the separate [Delivery recovery guide](question-delivery-recovery.md) for uncertain marketplace delivery.

Draft recovery uses the existing `ai_draft_lease` table and needs no new migration or environment setting. A full Redis wipe also removes the scheduler. Restart the backend after Redis is back so startup creates it again.

## Contact and support image limits

The contact form accepts **three messages per normalized email** and **five per IP fingerprint** in a rolling hour. Both limits use locks in the same PostgreSQL transaction, in a fixed order. Counting and saving finish before locks are released. Parallel backend processes share the locks.

A failed save or rejected request does not use the allowance. A filled honeypot keeps the existing silent acceptance behavior. Lock IDs are hashed; they do not use plain email or IP values.

Images attached to support messages have a shared **512 MiB account/workspace limit**. Customer replies, admin replies, and internal notes use the same total. An image-message transaction locks:

1. Relevant users in a fixed order with `FOR KEY SHARE`.
2. The workspace with `FOR NO KEY UPDATE`.
3. The ticket.

The quota check and image attachment happen in the same transaction. User locks prevent foreign-key lock-order conflicts during account deletion. The order matches deletion's user → workspace → ticket order. Messages without images do not need a storage quota check or workspace lock.

B2 uploads happen outside the lock. If quota or message saving fails, unattached files stay in the persistent cleanup process. Attached images are not deleted. Message, notification, or audit failure rolls back both image links and quota use.

Both limit checks use `READ COMMITTED`. After waiting for a lock, counts can see the previous successful transaction. These limit protections need no new migration or environment setting.

## Invitation logs

Backend HTTP logs leave out queries and fragments. Tokens in `/workspace-invitations/<token>` and `/invite/<token>` become `[REDACTED]`. This also covers encoded paths, completed or interrupted requests, error stacks, nested metadata, and logger context. Normal diagnostic fields, such as route, status, and duration, remain.

This does not change old log files, reverse proxy logs, or CDN logs. Configure those layers to hide invitation tokens too. Check every log layer in an HTTPS test environment.

## Migration and validation

AI leases require migration `20260927060000_add_ai_draft_lease`. During the original development work it was not applied to the application database. Check your current migration state. Do not run old and new workers together; old code has no AI lease protection.

1. Follow the old-worker shutdown order in [Delivery recovery](question-delivery-recovery.md), and take a suitable backup.
2. Install backend dependencies. Run `npm run db:generate` and `npm run build`. Apply `npm run db:migrate:deploy` to the target database.
3. Start only the new backend and workers. No new environment variables are needed. VAPID uses the existing notification settings.
4. Test subscription registration and real push in Chrome, Firefox, Edge, and supported Apple devices. An invalid or expired subscription must not block other recipients.
5. In two tabs, request drafts for the same and different questions. Check races with automation, retry after `429`, and free regeneration.
6. Send successful and failed requests with a fake invitation token. Check that backend and proxy logs do not contain it.

Local command, from the backend directory:

```sh
npm run check
```

Current AI lease and recovery tests use in-memory PostgreSQL and mocked queues. Old focused push/log and external-service integration test files are no longer in the source. `check` does not prove those paths. Validate the HTTPS, push, and logging cases above separately.
