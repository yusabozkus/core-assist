# Admin Email Delivery Tracking

The admin panel has an email list at `/admin/emails` and details at `/admin/emails/:emailId`. Customer details show the last five emails linked to that account. These pages track existing emails; they do not send emails.

## Setup

1. In the backend directory, run `npm run db:generate` and `npm run db:migrate:deploy`.
2. Set `RESEND_API_KEY` and `NOTIFICATION_EMAIL_FROM` in the backend environment. Check that the sender domain is verified in Resend.
3. Add a webhook in **Resend > Webhooks**. In production, use your public backend URL, for example `https://api.coreasistan.com/notifications/webhooks/resend`. For local development, use the **Resend Source URL** from Hookdeck, as explained below.
4. Select `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, and `email.suppressed`.
5. Save the signing secret as `RESEND_WEBHOOK_SECRET` in the backend and restart it. Do not expose this secret to the frontend.
6. Send a new test email to create a signed event. The last webhook time on the email page should change. The event's `data.email_id` must match the local email's Resend message ID to link its delivery details. A saved key alone does not prove that the webhook works.

### Local development with Hookdeck

When the backend runs on `localhost:4001`, the root `start-development.bat` starts separate Hookdeck listeners for Paddle and Resend. You can also start only the Resend listener:

```bash
hookdeck listen 4001 resend --path /notifications/webhooks/resend
```

If `hookdeck` is missing, install it with `npm install -g hookdeck-cli` and sign in to the same Hookdeck account used for Paddle.

Copy the **Requests to** URL for **Resend Source** from the Hookdeck output. Paste it into **Resend > Webhooks > Add Webhook**. Use the URL from Hookdeck, not localhost or the Paddle source URL. Do not add the local webhook path to this URL.

**Forwards to** should be `http://localhost:4001/notifications/webhooks/resend`. Save the secret from Resend as `RESEND_WEBHOOK_SECRET` in `backend/.env`, then restart the backend. Do not use Hookdeck changes that alter the body or `svix-*` headers. The backend checks the signature against the raw body.

Events received while the local listener is off are not automatically forwarded later. The backend also rejects signed events older than five minutes. Create a fresh test event for validation.

Old emails do not become “delivered” without their delivery events. Missing configuration does not block the email list.

## How it works

- `EmailDeliveryRecord.status` tracks the sending process.
- `EmailProviderMessage.status` tracks the provider's delivery result separately.
- `EmailDeliveryEvent` stores only event ID, Resend message ID, event type, and times. It does not store the recipient, subject, HTML, or raw webhook body.
- Signature checks use HMAC-SHA256 on the raw body, a constant-time comparison, and a five-minute timestamp limit. An invalid signature returns `401`; a missing key returns `503`; an invalid supported event returns `400`. Verified but unsupported events are ignored with `200`.
- `svix-id` is unique. Repeated events do not create another record. A provider message can be created before the send response arrives, then linked to the send later.
- Concurrent events use a lock on the same message row. Late sent or delayed events cannot replace a delivery or permanent failure result. Priority is: unknown → sent → delayed → delivered → failed → suppressed → bounced → complained. For the same result, the newest event time is kept.
- Delivery records follow the 90-day cleanup policy. Provider messages with no linked send and no update for 90 days are deleted with their events.
- The migration links old store emails, invitations that still exist, and billing emails with a known account. It does not guess an account from a recipient's email address.

## Checks

Run in the backend directory:

```bash
npm run check
```

`notification-email.policy.test.ts` checks email preferences, quota thresholds, and grouped emails with mocked services. The old focused admin email and webhook tests are no longer in the source. `check` does not verify all these paths. Test Resend signatures, delivery, and admin visibility separately in a live test environment. See [Quality checks](quality-checks.md).

Sources:

- [Resend webhook events](https://resend.com/docs/webhooks/event-types)
- [Resend signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests)
- [Svix signature format and test example](https://docs.svix.com/receiving/verifying-payloads/how-manual)
