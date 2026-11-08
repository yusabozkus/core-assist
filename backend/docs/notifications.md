# Notification Setup

Core Asistan provides in-app notifications and a live SSE stream by default. Operational emails are on for users without a saved preference. Users can turn them off, and existing opt-outs are kept. Browser notifications are optional. Settings stay disabled when their required environment variables are missing.

## Recipients and preferences

- AI review and answer errors go to store admins and agents.
- Sync, channel, and stock issues go to store admins.
- Billing and quota events go only to account owners and account admins.
- Team access and account security events go to the affected user.
- Viewers do not receive operational notifications.

Users can disable AI, sync, channel, and stock notifications for each store. Billing, team access, and account security notifications are required.

Routine successful syncs and each new question do not create notifications. Creating or canceling an invitation does not create an extra in-app notification for the person who did it. The invitation email to the invited person is a separate process.

## Browser notifications

Generate VAPID keys once:

```bash
npx web-push generate-vapid-keys
```

Add the values only to the backend environment:

```env
WEB_PUSH_VAPID_PUBLIC_KEY=""
WEB_PUSH_VAPID_PRIVATE_KEY=""
WEB_PUSH_VAPID_SUBJECT="mailto:support@example.com"
```

Push works on `localhost` in development and over HTTPS in production. When the user allows it in **Notifications > Preferences**, the app creates a service worker and device subscription.

## Email notifications

Emails use the Resend HTTP API. Verify the sender domain in Resend, then set:

```env
RESEND_API_KEY=""
NOTIFICATION_EMAIL_FROM="Core Asistan <notifications@coreasistan.com>"
```

Team invitation emails include the account, role, allowed stores, expiry date, and an acceptance link built with `FRONTEND_URL`. The database stores a hash of the invitation token. Pending email content stores it in encrypted form. Tokens are not logged.

Sends are recorded to prevent duplicates. Temporary errors retry. A failed email does not delete the invitation, and the team page offers a resend option.

### Email rules by role

This table defines the intended recipients and timing for important events. It does not mean that every row has complete end-to-end support. Validate real provider delivery and role access as described in [Quality checks](quality-checks.md).

| Event | Recipients | Timing |
| --- | --- | --- |
| Invitation created | Invited person | Immediate, required |
| Invitation accepted | Account owner and the admin who created it | Immediate |
| Role or store access changed, or membership removed | Affected user | Immediate, required |
| Payment failed, subscription or plan changed, invoice or refund | Account owner and account admins | Immediate |
| AI quota at 80% | Account owner and account admins | Based on email preference; once per period |
| AI quota at 90% or 100% | Account owner and account admins | Required; once at each threshold per shared quota period |
| Channel disconnected or repeated sync errors | Relevant store admins and account admins | At the event or threshold |
| Automatic answer failed or automation stopped | Relevant store admins and agents | Immediate |
| Questions waiting for review, or low or empty stock | Relevant store admins and agents | Daily or based on summary preferences |
| New device or sign-in provider change | Affected user | Immediate, required |
| Account deletion request | Affected user and account owner | Immediate, required |

The 90% and 100% quota emails go to verified email addresses, even when email delivery is off or quiet hours are active. Only account owners and account admins receive them. Stores and marketplaces that share a quota period also share notification and email IDs, so repeated events do not send new emails. A quota pause does not create an extra operational email. The 80% warning follows email preferences and quiet hours.

When the first store notification is created, missing delivery preferences are saved as on. Existing preferences stay the same. This lets users receive summaries before they open the preferences page.

AI reviews use grouped emails, rather than one email per question. The default interval is eight hours. Stock warnings are also grouped. Critical stock summaries are sent at least 24 hours apart.

## Quiet hours

Quiet hours pause browser and email delivery during the selected period. Critical quota emails at 90% and 100%, payment, subscription, and security emails are exceptions. In-app notifications are still saved and counted as unread. Quiet hours use the store's time zone.

## Retention and live updates

```env
NOTIFICATION_RETENTION_DAYS="90"
NOTIFICATION_CLEANUP_INTERVAL_MS="86400000"
REDIS_URL="redis://localhost:6379"
```

Cleanup deletes only read notifications older than the retention period. Unread notifications are kept. Redis Pub/Sub sends changes from all backend instances to every open SSE connection.
