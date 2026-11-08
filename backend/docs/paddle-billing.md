# Paddle Billing Setup

Core Asistan opens payments with Paddle.js. The backend checks the plan and price. A browser payment result does not grant access. Signed Paddle subscription webhooks update the subscription. A read-only recovery process can also check Paddle when a webhook is missed.

## Account and subscription scope

Each user can own at most one internal `Workspace`. It groups stores, the subscription, and shared usage limits. The UI does not ask users to create or choose a workspace.

- `Workspace.ownerId` is unique. Account creation, onboarding, and billing preparation use the same service and user-row lock. Repeated or concurrent requests return the existing record. They do not create another account, trial, or subscription.
- `/billing` opens the account's billing area. When no billing account is returned, the UI prepares it automatically. This does not start a payment or reset an existing subscription. The backend preparation API needs no store or completed onboarding. The current billing pages do require completed onboarding.
- Store admin access alone does not grant billing access. Financial permissions and trusted payment/account links still apply.
- Migration `20260911120000_enforce_single_owned_workspace` stops with an error if old data has several workspaces with the same owner. Review those records first. It does not merge or delete stores or financial data.

## 1. Environment variables

Add sandbox values to `backend/.env`:

```ini
PADDLE_ENV="sandbox"
PADDLE_API_KEY="pdl_sdbx_apikey_..."
PADDLE_WEBHOOK_SECRET="pdl_ntfset_..."
PADDLE_PRICE_STARTER_MONTHLY="pri_..."
PADDLE_PRICE_STARTER_ANNUAL="pri_..."
PADDLE_PRICE_GROWTH_MONTHLY="pri_..."
PADDLE_PRICE_GROWTH_ANNUAL="pri_..."
PADDLE_PRICE_BUSINESS_MONTHLY="pri_..."
PADDLE_PRICE_BUSINESS_ANNUAL="pri_..."
```

Add the browser client token to `frontend/.env.local`. Never put the API key in the frontend.

```ini
NEXT_PUBLIC_PADDLE_ENV="sandbox"
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="test_..."
```

## 2. Webhook destination

In Paddle Sandbox, open **Developer tools > Notifications > New destination**. Use a public backend URL such as:

```text
https://api.coreasistan.com/billing/webhooks/paddle
```

Paddle cannot call a private localhost address. For local tests, use an HTTPS tunnel that forwards to the same backend path.

Select these events:

- `subscription.created`
- `subscription.updated`
- `subscription.activated`
- `subscription.trialing`
- `subscription.past_due`
- `subscription.paused`
- `subscription.resumed`
- `subscription.canceled`
- `transaction.completed`
- `transaction.created`
- `transaction.ready`
- `transaction.payment_failed`
- `transaction.past_due`
- `adjustment.created`
- `adjustment.updated`

Save the destination's endpoint secret as `PADDLE_WEBHOOK_SECRET`.

## 3. Database and app

```bash
cd backend
npm run db:migrate:deploy
npm run db:generate
npm run start:dev
```

Restart the frontend after environment changes. Public frontend values are read during the build.

```bash
cd frontend
npm run dev
```

Select a plan and continue to payment. Paddle Sandbox checkout should open. Use the [official Paddle test cards](https://developer.paddle.com/concepts/payment-methods/card/). After a successful test payment, a subscription webhook updates the local record.

## 4. Trusted payment and account links

After checking the user's permission and selected plan, the backend creates a Paddle transaction. Before returning its ID to the browser, it saves these details in `billing_checkout`:

- Workspace and user who started the payment.
- Sandbox or production environment, expected price ID, plan, and billing cycle.
- Paddle transaction ID and, when available, the customer and previous subscription IDs.
- The linked subscription ID and link time after webhook verification.

The first link uses `transaction_id` from `subscription.created`. Later events must match saved subscription and customer IDs. `custom_data` is only for diagnostics. It is **never used to choose the workspace or plan**. This matters because [Paddle.js can also send custom data](https://developer.paddle.com/build/transactions/custom-data/). See [subscription.created](https://developer.paddle.com/webhooks/subscriptions/subscription-created/) for the first transaction reference.

The app may crash after Paddle creates a transaction but before its ID is saved locally. A verified `transaction.created`, `transaction.ready`, or `transaction.completed` event can help recover it. `coreassist_checkout_id` only finds the local reservation; it does not grant permission. The backend also checks the API source, workspace, environment, configured price, plan, cycle, customer, and previous subscription state. After a match, it links the transaction conditionally and brings the next recovery check forward. A transaction webhook alone does not grant subscription access.

The price must be known to the backend and match the saved checkout plan and price. The subscription must have one item, quantity one, and the expected monthly or annual cycle. An unknown price or wrong link is rejected with a `409` processing error. The event is not marked as processed. Webhook processing runs in a worker, so this error does not change an earlier HTTP `200` queue response.

If events arrive out of order, retry after the first link is created. Monitor failed Paddle/Hookdeck deliveries and queue jobs. A permanent price or customer mismatch needs a fix; retries alone will not solve it.

A workspace-row lock prevents concurrent webhooks from replacing each other's subscription. The subscription ID can change only after cancellation or expiry, through a new checkout that records the previous ID. An old checkout cannot replace the current link.

### Updating an existing installation

- Apply `20260909203000_add_trusted_billing_checkouts`, generate the Prisma client, and restart the backend. This migration does not delete data.
- Existing linked subscriptions keep working with their saved customer/subscription IDs and known prices. The app does not create old links from metadata.
- Start a new checkout for an unlinked checkout opened before this change. If payment was already taken, do not charge again. An admin must verify the transaction and workspace against Paddle and server records before any manual link.
- When changing price IDs, keep prices used by existing subscriptions in the mapping. Unknown old prices are also rejected safely.
- No new Paddle metadata field or webhook destination is needed. Keep the events above selected.

## 5. Prevent duplicate checkouts

Migration `20260909210000_serialize_billing_checkouts` adds checkout states and one pending checkout per workspace. Apply migrations, generate the Prisma client, and restart the backend.

- **Concurrent requests:** A short PostgreSQL row lock reserves the checkout. `CREATING` is committed before the Paddle request. A partial unique index blocks a second `CREATING`, `OPEN`, or `REVIEW_REQUIRED` record for the workspace, across backend instances. Network calls do not hold the database lock.
- **Refresh and retry:** An open transaction for the same plan/cycle is checked in Paddle and reused. If another tab is preparing it, the frontend waits briefly and checks again. It does not create a second transaction. Browser memory and localStorage do not enforce this protection.
- **Payment complete, webhook late:** A `paid`, `completed`, or subscription-linked transaction does not open another form. The app waits for subscription verification. Reading a payment status alone does not grant a plan.
- **Different plan:** The app does not silently change an open transaction's amount or create another transaction. It returns the existing payment page. A new checkout requires confirmed cancellation in Paddle. Closing the window or waiting is not cancellation.
- **Error or timeout:** A clear Paddle rejection sets `FAILED` and allows retry. An uncertain result sets `REVIEW_REQUIRED`. A crash before saving the response may leave `CREATING`. These records are not deleted or taken over after a timeout.

Paddle does not provide a general client idempotency key for this flow. Creating another transaction blindly after a timeout is unsafe. The [Paddle SDK retry guide](https://developer.paddle.com/sdks/libraries/) recommends checking the existing operation first.

### Admin review of an uncertain checkout

Find the Paddle record using the checkout ID from server logs and the transaction ID, if known. `coreassist_checkout_id` helps search, but metadata alone does not prove ownership. Check the workspace, expected price, customer, previous subscription, and API records together.

If the transaction exists, link its correct ID to the same reservation and redeliver the related webhook. Do not ask for another payment. Close the reservation only after confirming that no transaction exists, or that it was canceled and can no longer be paid.

The migration stops if old data has several unlinked checkouts for one workspace. It does not delete possible payments or choose one at random. Match them against Paddle records first.

## 6. Webhook order and subscription state

`subscription.*` events are the webhook source for access changes. Verified transaction events are recorded in `billing_webhook_event` to prevent duplicates. They do not change the plan, status, period dates, or `paddleUpdatedAt`. An old invoice payment, one-time charge, or card update cannot activate a paused or canceled subscription. Renewal and payment-failure state changes come from subscription events. See [Paddle access management](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/).

`paddleUpdatedAt` is the last applied subscription event's `occurred_at`, not its arrival time. It is saved in the same transaction as the subscription update. Invalid event dates are rejected, not replaced with the server's current time.

The workspace is locked before the subscription row. The app reads the record again after locking. ID checks, date comparisons, state updates, and the processed-event record share one transaction. An older concurrent event cannot replace a newer state. For conflicting states at the same time, the more restrictive state wins. The same state/time is not applied again.

A canceled subscription ID cannot be activated again. A new subscription needs a new verified checkout link. Local trial expiry also uses a conditional update, so it cannot replace a concurrent paid activation. Paddle trial state follows webhooks, while access checks still enforce the trial end date.

### Local validation

- Keep `subscription.created` and `subscription.updated` selected in the destination.
- If `transaction.completed` arrives first, checkout waits for a subscription event. Replaying only the transaction event must not activate the plan.
- An early `subscription.updated` can retry after the first link is created. An unmatched event is not marked as processed.
- Replay an old `subscription.past_due` after a newer `subscription.updated` or `subscription.activated`. Status and dates must not move backward.
- Deliver `transaction.completed` for a paused subscription. It must not grant access. A newer subscription event is needed.

These ordering checks need no extra migration or environment variable.

## 7. Failed webhooks and redelivery

The endpoint verifies the Paddle signature against the unchanged raw body. Once a unique event-ID job is saved in the `paddle-webhooks` BullMQ queue, it returns `200`. A worker handles subscription, checkout, and notification work separately from the HTTP request.

- An invalid signature or event envelope returns `400` without enqueueing.
- If Redis cannot confirm the write within 3.5 seconds, the endpoint returns `503` so Paddle can retry. Event IDs prevent duplicate processing if the first queue write finishes late.
- The worker allows 10 attempts with increasing delays. Failed jobs are kept for seven days. Redelivery of the same event ID retries an exhausted failed job.

Database duplicate detection uses only `INSERT ... ON CONFLICT ("id") DO NOTHING` on `billing_webhook_event.id`. A unique conflict (`P2002`) on a customer, subscription, or checkout is an error, not a duplicate delivery.

- The event record and subscription update share a transaction. Matching, price, or database failure rolls back both. A failed event leaves no permanent processed marker.
- Concurrent deliveries with the same event ID wait in the database. If the first succeeds, the second gets `duplicate: true`. If the first rolls back, the other can process it.
- Worker errors do not change the earlier HTTP response. They appear as BullMQ retries and failed jobs.
- Logs include `eventId`, `eventType`, `errorCode`, and, for unique errors, `constraintFields`. They exclude webhook bodies, signatures, customer details, and raw database error messages.
- Intentionally unused event types are acknowledged internally with `processed: false, ignored: true`, keeping only the delivery record. This differs from an unmatched subscription event that needs processing. Safe old subscription events are also accepted without changing state again.

### Retry a failed event

1. Match the Paddle/Hookdeck event ID with backend logs and the queue job.
2. Use the error code to investigate missing checkout links, subscription links, or ID conflicts. Do not link from metadata alone or charge again.
3. Fix the issue and redeliver the same event. A failed transaction did not consume the event ID. A repeated successful event should produce only `duplicate: true` during processing.

Paddle retries failed HTTP deliveries automatically. After retries end, redeliver from its dashboard or API. Sandbox has fewer retries than live. See [Paddle delivery and retries](https://developer.paddle.com/webhooks/about/respond-to-webhooks/).

Old events wrongly marked as processed by an earlier version are not deleted automatically. Verify the event and current subscription before repair. This behavior needs no extra migration.

## 8. Account deletion and stopping payments

Account deletion uses `POST /users/me/delete`. The general Better Auth `delete-user` endpoint is disabled, so it cannot bypass billing checks. Cancellation and deletion require a valid session created within the last hour, an allowed frontend origin, and exact confirmation text.

`GET /users/me/deletion-status` checks only workspaces the user owns. Membership in someone else's account does not allow cancellation of its subscription.

1. The app checks local subscription and checkout references against Paddle. Active, trialing, paused, and past-due subscriptions block deletion. A cancellation planned for period end is not a completed cancellation. The dialog shows the planned cancellation/access date.
2. `POST /users/me/close-billing` with the exact text `TAHSİLATI DURDUR` (“Stop payments”) immediately cancels verified subscriptions and closes open checkouts that can be canceled. This does not delete the account. Access ends immediately, and no refund is automatic. Users who want access until period end must delete the account later.
3. Billed or past-due invoices, payments in progress, uncertain `CREATING`/`REVIEW_REQUIRED` records, and unmatched subscriptions are not automatically removed or waived. Wait for a clear result or a trusted link after support review. A `404` or timeout does not confirm cancellation.
4. The account stays if only some cancellations succeed. A database rollback cannot reverse a completed Paddle cancellation. The UI explains this. On retry, the app reads Paddle again and skips subscriptions already canceled.
5. With the exact text `HESABIMI SİL` (“Delete my account”), the app checks Paddle again. It locks user, workspace, subscription, and store rows, then checks state changes and active or queued jobs. A new checkout stops deletion. The financial closure record and user deletion are saved in one transaction.

This uses the [Paddle cancellation API](https://developer.paddle.com/api-reference/subscriptions/cancel-subscription/) and [transaction update API](https://developer.paddle.com/api-reference/transactions/update-transaction/). The API key needs subscription read/write and transaction read/write permissions. Do not run automatic cancellation tests on real accounts.

### Financial records

`BillingClosureRecord` is separate from the user and workspace, so deleting them does not delete it. It keeps only workspace references, Paddle environment, subscription/customer/transaction IDs, cancellation and verification times, price/plan references, and verified transaction amounts.

It does not archive names, emails, addresses, card or token details, raw webhooks, catalog data, or messages. These are limited financial references that can still be linked to a person; they are not anonymous. Account deletion does not delete Paddle customer or invoice records. Normal user APIs do not expose closure records. Limit database access to authorized operators.

A later signed webhook for a closed subscription does not recreate its state when subscription ID, customer ID, and environment match the closure record. Unmatched events follow normal error and retry rules.

Before production, define how long to keep financial records, who can access them, and how to delete them under the business's obligations. This feature does not set a legal retention period or automatically delete financial records.

Apply `20260909220000_add_billing_closure_records` and generate the Prisma client again. No new environment variable is needed.

## 9. Billing permissions

`BillingAuthorizationService` allows the workspace's `ownerId`, or a user with `WorkspaceRole.OWNER` or `WorkspaceRole.ADMIN` in that workspace. `StoreRole.OWNER` or `StoreRole.ADMIN` alone is not enough. An admin role in another workspace gives no access.

These endpoints check database permissions on every request:

- `GET /workspaces/:workspaceId/billing/summary`
- `GET /workspaces/:workspaceId/billing/invoices`
- `GET /workspaces/:workspaceId/billing/invoices/:transactionId/pdf`
- `POST /workspaces/:workspaceId/billing/checkout`
- `POST /workspaces/:workspaceId/billing/portal-session`

Unauthorized requests return `403 / BILLING_FORBIDDEN` before a Paddle call or checkout creation. PDF downloads also check that the invoice belongs to the correct Paddle customer. Internal quota and access checks remain separate from billing management permission.

`GET /workspaces/:workspaceId/billing/access` returns only the current user's `canManageBilling` value for an accessible workspace. It does not return invoices, members, or payment details. Sidebar links use the list of accounts the user can manage. Plan, invoice, and payment pages also check access on the server. Client role fields cannot grant permission.

This uses existing workspace roles, with no separate billing role or migration. Account closure still covers only accounts the user owns. Billing admin access does not allow deleting another user's account.

## 10. Change an existing subscription plan

For an active Paddle subscription, plan cards show a price preview for changing that subscription. They do not open a new checkout. First purchases still use checkout. Opening `/checkout` with an existing subscription redirects to plans.

### Product rules

- Upgrades and downgrades apply **immediately after confirmation**. There is no separate job to change plans at period end.
- Paddle uses `prorated_immediately` to calculate unused time and the new charge. The preview shows the amount due now, charge or credit difference, next payment date and amount, and new limits. A credit is not a promise of a cash refund.
- `onPaymentFailure: prevent_change` keeps the plan unchanged if payment fails. Local plan and limit changes require verified Paddle subscription state; a successful update response alone does not grant access.
- A change is blocked if active stores, workspace members, or active products exceed the new limit. Nothing is deleted or archived. Counts are checked again before confirmation. While a change is pending, new resources use the smaller of the old and new limits.
- Downgrading does not clear monthly question usage. AI quota checks still apply; manual answers stay available. The paid subscription's `usagePeriodAnchor` is kept. Changing plans or switching monthly/annual billing does not grant extra question quota. The preview shows the quota reset date separately.
- First resolve past-due, paused, or Paddle trial subscriptions, planned cancellation/pause, and renewals less than 30 minutes away. This flow does not silently remove a cancellation request.

### Security and retries

- `POST /workspaces/:workspaceId/billing/plan-changes/preview` creates a five-minute preview linked to the user, workspace, subscription, source price, and target price.
- `POST /workspaces/:workspaceId/billing/plan-changes/:changeId/confirm` requires the same user who created the preview, with billing permission still valid.
- `GET /workspaces/:workspaceId/billing/plan-changes/:changeId` checks billing permission. IDs from another workspace are rejected.
- POST endpoints check `Origin`. Set `FRONTEND_URL` correctly in production. The client does not choose amounts, price IDs, subscription IDs, or how the change applies. The server uses its own plan/price mapping.
- Confirmation gets a fresh Paddle preview. Changes to amount, discount, address, subscription, or price require a new preview and confirmation. The amount can change while waiting because prorated charges depend on time.
- A workspace lock and partial unique index allow only one `PROCESSING`, `RETRY_SCHEDULED`, `AWAITING_WEBHOOK`, or `REVIEW_REQUIRED` change at a time. The reservation is saved before the external API call.
- Double clicks, another tab, or a repeated POST do not send the change again. An uncertain connection error or process restart does not clear the reservation.

A Paddle `too_many_requests` response is a known rate limit, not an uncertain result. Its `Retry-After` is saved as `retryAfterSeconds` and `retryAt`. The change becomes `RETRY_SCHEDULED`. Billing recovery retries only after that time. After five automatic retries also hit the rate limit, it becomes `FAILED` so the lock does not remain forever.

When Paddle accepts a change, `reconcileAfter` is moved forward for an immediate check. While a change is `AWAITING_WEBHOOK` or `REVIEW_REQUIRED`, checks are at most five minutes apart, instead of waiting for the normal hourly check.

For `REVIEW_REQUIRED`, logs include the change reference. The app does not send another PATCH. Check the subscription and transaction history in Paddle, then redeliver the matching `subscription.updated`. A verified applied change closes through subscription processing. Do not reset local state without proof that it was not applied. There is no blind retry or automatic timeout release.

A pending change blocks checkout and account deletion. The UI polls its status and offers manual refresh after a long wait.

### Setup and sandbox checks

Apply `20260910090000_add_subscription_plan_changes` and run `npm run db:generate`. The API key needs **subscription.read** and **subscription.write**. Existing monthly/annual price IDs are used. No extra Paddle product or webhook destination is needed.

With an active sandbox subscription, select another plan, review charges and limits, then confirm. Check that the Paddle subscription ID stays the same, verified subscription state updates the plan, and no checkout opens. Also test a smaller plan over capacity, card rejection, two tabs, and a late webhook.

Sources: [Paddle upgrades and downgrades](https://developer.paddle.com/build/subscriptions/replace-products-prices-upgrade-downgrade/), [update preview](https://developer.paddle.com/api-reference/subscriptions/preview-subscription-update/), and [proration](https://developer.paddle.com/concepts/subscriptions/proration/).

## 11. Billing without an active store

Financial APIs use `/workspaces/:workspaceId/billing/*`. Old store-based billing endpoints were removed, so update the frontend and backend together. Product, channel, and question quota checks still apply.

- `GET /billing/workspaces` returns IDs and names only for accounts the user can manage financially. The API does not require a store or completed onboarding and does not list unrelated accounts.
- `POST /billing/workspaces` prepares the user's owned account. It shares the user-row lock with onboarding. Repeated calls reuse that account, even if it is empty or expired. It does not create a store, complete onboarding, or reset a trial.
- Current `/billing` pages require sign-in and completed onboarding. The entry page opens the first account returned by the billing list. If the list is empty, the UI automatically calls the preparation API. There is no workspace picker or manual creation form in the current UI.
- Subscription, plans, and invoices use `/billing/:workspaceId`, `/billing/:workspaceId/plans`, and `/billing/:workspaceId/invoices`. They do not require an active store. Every financial API request still checks permission.
- Checkout uses `/checkout?workspaceId=...&plan=...&cycle=...`. The active-store cookie does not choose the payment account. Changing stores in another tab, refreshing, or retrying keeps the same workspace link. Payment returns to that account's subscription page.
- After the last store is deleted, an account with completed onboarding can still manage invoices, payments, and cancellation, even with an expired trial or paused subscription. Adding stores and using AI still require plan access and capacity.
- Old dashboard billing links use Next.js redirects to the new billing entry. These redirects do not bypass the current onboarding check.

No extra migration or Paddle setting is needed for these routes. Restart the frontend if it does not pick up `next.config.ts` changes.

### Manual checks

1. On a test account with completed onboarding, remove the last store and open `/billing`. The same subscription and invoices should remain available.
2. With an expired trial, check that plans and payment are available even if store creation is blocked. After sandbox payment and webhook processing, store setup should become available under the new plan.
3. Check that the selected account name and URL ID stay consistent. Payment, portal, and invoice requests must use that account, including when the user manages another account.
4. A store admin without account billing permission must get `403` from invoice, payment, and cancellation endpoints, even with the URL.

## 12. Subscription access, quota, and jobs

Question quota and subscription access are separate checks. `billing-access.policy.ts` applies the same access rules to database scheduler filters and workers. Store permissions and connection security checks also apply.

| Operation | Active subscription or trial | Only AI quota is full | Subscription access is closed |
| --- | --- | --- | --- |
| AI draft for a new question | Within quota | Stops | Stops |
| Included regenerations | Available | Existing rights stay | Stops |
| Automatic send of an already prepared safe answer | With safety checks | Continues, with no second quota charge | Stops for manual review |
| Catalog, stock, and question sync | Continues | Continues | Manual and automatic jobs stop |
| Size-chart image analysis | Continues | Independent of question quota | Stops, including queued analysis |
| Manual answer or manual send of a saved draft | Available | Available | Available |
| Saved data, performance history, and billing | Available | Available | Available; billing permissions still apply |

### When access ends

- `TRIALING` allows access only while `trialEndsAt` is in the future.
- `ACTIVE` allows access while `currentPeriodEnd` is in the future. Eligible auto-renewing Paddle subscriptions have a limited 30-minute verification window after period end. See section 13.
- `cancelAtPeriodEnd=true` alone does not stop access. An active subscription keeps access until its end date.
- `PAST_DUE`, `PAUSED`, `CANCELED`, `EXPIRED`, or a missing subscription block access. There is no extra usage period for failed payments. A delayed renewal can use the limited verification window, but unverified access does not continue after it ends.
- Schedulers do not start a new trial for a missing subscription. A full quota does not cancel the subscription or mark a connection as broken.

### Queue and sync behavior

- Automatic sending checks access when queued, at worker start, and after live stock validation, immediately before the marketplace POST. This is separate from AI quota.
- If access is closed, the answer becomes `FAILED` with a reason. Its text stays, and the question becomes `NEEDS_REVIEW`. Automatic-send eligibility is removed. Renewing does not resend the old answer. The user must review and send it manually or request a new evaluation.
- Product/stock and question schedulers select only accounts with access. Manual updates, retries, and onboarding queue entry also check access. Workers catch expiry while a job waits.
- Multi-page sync checks access before and after every provider page. An interrupted full catalog sync does not archive products missing from unfinished pages. Already saved pages stay. The next sync uses the normal upsert and matching flow.
- Quota and subscription blocks do not use the three retries for temporary provider errors. The application job record closes and releases its connection lock. Sync history shows `FAILED` with a subscription reason. The channel is not changed to `ERROR`.
- Size-chart analysis also checks access. Analysis stopped by a subscription block can be queued again during the next full catalog sync.
- After reactivation, periodic sync continues on the next scheduler run, and manual update is available again. After quota resets, question sync can review pending questions again.
- An HTTP request already accepted by an external service cannot be reversed. Checks run before new requests. An AI/API call already in progress may still return after access ends.

The subscription page explains active access, full quota, and closed access separately. The cancellation page uses the same rules. When access is closed, saved stock is from the last update and must not be treated as live.

### Local and sandbox checks

1. Close access while an automatic answer is queued. It must not reach the marketplace, and the draft must stay for manual review.
2. Fill only the question quota on an active subscription. Stock/question sync and prepared safe answers should continue. A new draft should return `AI_QUESTION_QUOTA_EXCEEDED`.
3. With access closed, try stock or question sync. Expect `402 / BILLING_ACCESS_REQUIRED`. Manual answers to saved questions should remain available.
4. Schedule cancellation for a future end date. Sync and automatic sending should work until then.
5. Reactivate the subscription. New sync should work. Old stopped automatic answers must not send without review.

This access policy needs no extra migration, environment variable, or Paddle setting. Focused local checks do not make real charges, AI calls, or marketplace sends.

## 13. Delayed renewals and missed webhooks

### Waiting policy

Only an `ACTIVE` subscription with a linked Paddle ID and no planned end-of-period cancellation or pause can use the fixed `currentPeriodEnd + 30 minutes` limit. Refreshing, API errors, or retries do not extend it. Trials and `PAST_DUE`, `PAUSED`, `CANCELED`, or `EXPIRED` subscriptions get no extra time. Verified payment issues apply immediately. Planned cancellation or pause stops access at its effective date.

This window does not grant a new monthly AI quota. Usage stays in the last verified period. After Paddle confirms the new period, the monthly usage anchor advances normally. Trial expiry checks status, Paddle ID, and `updatedAt`, so it cannot replace concurrent payment activation.

### Automatic comparison with Paddle

- The `billing-recovery` BullMQ scheduler selects up to 20 due records each minute. Subscriptions within 24 hours of renewal, recently past renewal, `PAST_DUE`, or waiting for first payment are checked about every five minutes. Other linked Paddle subscriptions are checked hourly. Queue load can affect timing.
- Recovery only reads Paddle. It does not create payments, charge cards, or cancel subscriptions. Webhooks remain the main update path.
- Linked subscriptions use `GET /subscriptions/{id}`. If the first `subscription.created` was missed, recovery reads only the transaction ID saved for an open checkout. A completed transaction's subscription ID must pass the trusted price, customer, and previous-subscription checks again.
- `customData` cannot grant access. `CREATING` or `REVIEW_REQUIRED` checkouts with a missing transaction ID need admin review; recovery does not guess a link.
- API results and webhooks share the update path. Paddle resource `updated_at` is stored in `paddleSnapshotAt`; webhook event time uses `paddleUpdatedAt`. An old snapshot cannot replace a newer state. If the local record changed during the network call, an `updatedAt` check under workspace/row locks rejects the result and schedules another check.
- A database lease protects work across workers. After a crash, another worker can claim it after five minutes. Each API call has a 15-second wait limit. The SDK cannot physically cancel its HTTP request, but a late read result cannot proceed to update the database.
- API, permission, or matching errors retry after 5, 10, 20, 40, then at most 60 minutes. Track `lastReconciledAt`, `reconcileAfter`, `reconcileFailures`, and `reconcileErrorCode`. Failure does not advance the last successful check time. Logs exclude secrets and raw payment data.

### User warnings and pending questions

Payment issues and unverified renewal create a required in-app `BILLING_PAYMENT_ISSUE` notification. Only the workspace owner and `OWNER`/`ADMIN` workspace members receive it. A store admin role alone is not enough. No store is required. The notification is saved with the subscription update and is not repeated for the same period. This recovery alert does not use store email or browser preferences to send outside the app.

The subscription page explains the delay and links to payment-method updates in the Paddle portal. While visible, it checks the local summary every 30 seconds and refreshes when the state changes.

Quota blocks use `BLOCKED_QUOTA`; subscription blocks use `BLOCKED_SUBSCRIPTION`. The inbox shows “Waiting for quota” or “Waiting for subscription”. These are not general AI errors and do not create a separate error notification for each question. AI jobs are not queued again while blocked.

A separate local check runs every five minutes. It queues eligible pending questions again when access and quota are available, following the current automation mode. The store must be active, with a matched product and channel.

Failed Redis jobs with the same ID need a real retry and reset attempt counters; another `add` alone will not run them. The same check recovers records that have been `QUEUED` for at least one minute when Redis is missing the job or has a completed/failed job. Waiting, delayed, and active jobs stay unchanged. Access and question-level quota checks run before restart.

Manually answered questions and automatic sends stopped for safety are never sent again automatically.

### Setup and test

Apply `20260910120000_add_billing_recovery`:

```powershell
cd backend
npm run db:migrate:deploy
npm run db:generate
```

Restart the backend with Redis and BullMQ workers running. No new Paddle key is needed. The existing key needs `subscription.read` and `transaction.read`. Signature verification and the webhook destination stay the same.

In Sandbox, pause renewal webhook delivery and wait for the next period. Check that the read-only comparison repairs the local period. For payment failure, check the financial alert and payment-method link. For full quota, check the waiting state without a new AI call. Do not make test charges or cancellations in production.

Sources: [Paddle access and periodic checks](https://developer.paddle.com/build/subscriptions/provision-access-webhooks/) and [Get subscription](https://developer.paddle.com/api-reference/subscriptions/get-subscription/). The 30-minute window is Core Asistan policy, not a Paddle requirement.

## Dynamic plan prices

Frontend constants do not set plan prices or annual savings. `GET /billing/pricing` returns only the six configured Paddle price IDs and the sandbox/production environment. It does not return the API key or other secrets. Landing, plan selection, checkout summary, and current-plan screens use one `Paddle.PricePreview()` request for this catalog.

Paddle totals depend on visitor location, currency, tax, and price settings. The annual monthly equivalent and savings rate come from monthly/annual totals, with no fixed discount in code. An incomplete catalog or environment mismatch disables plan selection and offers retry. The checkout form always shows the final amount.

Core Asistan's local trial lasts 10 days, needs no card, and starts only once. Its quota is 100 questions. **Turn off Trials on all monthly and annual Paddle prices.** Price preview, first checkout, plan change, and webhook binding check that `trial_period` is absent. A price with a Paddle trial cannot grant a paid plan. This prevents a second trial or a paid user being kept on the local trial limit.

Browser and backend price caches last five minutes, so a Paddle change may appear with a short delay. To publish new prices, update the relevant `PADDLE_PRICE_*` values and restart the backend.

Sources: [Paddle.PricePreview](https://developer.paddle.com/paddle-js/methods/paddle-pricepreview/) and [Dynamic pricing pages](https://developer.paddle.com/build/checkout/build-pricing-page/).

## Retention of billing operation records

BullMQ runs `billing-retention-cleanup` daily. It handles each collection oldest first, in batches of 500 and up to 10,000 records per run. This limits long locks on live checkout or webhook transactions. Backlogs are cleared over later runs.

- Keep successfully processed `billing_webhook_event` IDs for 180 days from `processedAt`. Old events are still subject to subscription snapshot and date checks if delivered after this period.
- Keep unlinked `CANCELED` and `FAILED` checkouts for 90 days. Do not automatically delete `CREATING`, `OPEN`, or `REVIEW_REQUIRED` records.
- Keep `COMPLETED` checkouts until workspace deletion. They are part of the trusted transaction/subscription link.
- Delete expired `PREVIEWED` plan changes after an extra 24 hours, `FAILED` changes after 90 days, and `COMPLETED` changes after one year.
- Do not clean up unresolved `PROCESSING`, `RETRY_SCHEDULED`, `AWAITING_WEBHOOK`, or `REVIEW_REQUIRED` plan changes.

These are operational matching and diagnostic records. This job does not delete Paddle invoices or legal financial records. Cleanup uses `processedAt`, `status + updatedAt`, and `status + expiresAt` indexes. Apply `20260912120000_add_billing_retention_indexes` before enabling scheduled cleanup in production. See [Data retention](../../DATA_RETENTION.md) for the wider policy.
