# Core Asistan Admin Panel

This guide explains access, features, and security rules for the internal admin panel. It describes the current panel, rather than past development tasks.

## Access

Admin accounts use a list of verified email addresses in the backend environment:

```ini
ADMIN_EMAILS="admin1@example.com,admin2@example.com"
```

- Keep this list in the backend. Do not publish it with a `NEXT_PUBLIC_` variable.
- Email checks remove extra spaces, use lowercase, and require an exact match.
- The user must have a valid session and a verified email address.
- An empty list gives admin access to nobody.
- Frontend checks control links and redirects. Backend `AuthGuard` and `AdminGuard` enforce access.
- Admin accounts do not need a customer account, store, or onboarding record. After sign-in, they go to `/admin`.

If the team needs different admin permissions, replace the email list with database roles and clear permission rules.

## Pages

| Area | Route | Purpose |
| --- | --- | --- |
| Overview | `/admin` | Customer, subscription, support, and operation summaries |
| Customers | `/admin/customers` | Customer accounts, users, stores, and usage |
| Customer details | `/admin/customers/[workspaceId]` | One account's team, stores, channels, support, and billing |
| Subscriptions | `/admin/billing` | Subscriptions, payments, checkouts, and plan changes |
| Subscription details | `/admin/billing/[workspaceId]` | Paddle IDs, periods, usage, and status checks |
| Support tickets | `/admin/support` | Ticket filters, SLA targets, and assigned staff |
| Support chat | `/admin/support/[ticketId]` | Messages, internal notes, assignment, and ticket status |
| Contact messages | `/admin/contact-messages` | Contact forms sent from the landing page |
| Emails | `/admin/emails` | Send history, delivery results, errors, and configuration |
| Email details | `/admin/emails/[emailId]` | Attempt times, error reasons, and verified delivery events |
| Announcements | `/admin/announcements` | In-app messages by role, with optional emails |
| Operations | `/admin/operations` | Catalog and question syncs, and connection issues |
| Queue details | `/admin/operations/queues/[queueKey]` | Scheduled, delayed, and failed worker jobs |
| AI and usage | `/admin/ai-usage` | Draft results, quotas, and current blockers |
| AI blocker details | `/admin/ai-usage/blockers/[type]` | Records grouped by error or waiting reason |
| System health | `/admin/system` | API, PostgreSQL, Redis, queues, Paddle, and channel health |
| Audit logs | `/admin/audit-logs` | Important actions, actor details, and results |
| Account and security | `/admin/account` | Admin profile, sign-in providers, and sessions |

Header search supports customer email and account, store, ticket number, sync ID, and Paddle customer, subscription, or transaction ID.

## Email tracking

- Search by recipient, subject, Resend message ID, customer, or store. Filter by send status, delivery status, and creation date. Dates use Turkey time, and the end date is included.
- Customer details show the last five emails linked to that account. The link uses an explicit `workspaceId` or the store's account. Emails for another account are not included just because the recipient is the same. Old records without account context stay in the general list.
- `SENT` means Resend accepted the email. Separate webhook events confirm delivery to the recipient's mail server. The system does not track whether the email was read.
- The last-24-hour counters use acceptance, delivery result, and error times. Pending and review counters include all open records. List filters do not change these counters, but customer or store scope does.
- Configuration cards show whether keys and a sender address exist. They do not confirm domain verification or provider availability. The panel also shows the last verified webhook and attempts delayed by more than five minutes.
- Admin responses do not include raw HTML, invitation tokens, idempotency keys, or secret API keys. These email pages are read-only.
- Temporary send errors use the existing retry process. Check uncertain `REVIEW_REQUIRED` records in Resend.

See [Email delivery tracking](backend/docs/admin-emails.md) for setup and checks.

## Announcements

An admin enters a title and message, then selects account owners, account admins, store admins, agents, or viewers. **All** selects every role. Role matching follows the team page. Each user receives one notification, even if they have several stores. Platform admins are excluded.

**Send email too** is available only when Resend, a sender address, and the app URL are set. Users with an unverified email receive only the in-app message. The preview shows notification and email counts, skipped addresses, and sample recipients. It is valid for 10 minutes. Changes to recipients or roles require a new preview.

Confirmation creates notifications and email delivery records in one database transaction. Existing email jobs send the emails. Track send and delivery results at `/admin/emails`. Repeating the same confirmation does not send twice. The panel shows the last 30 announcements and records each action in the audit log. The audience limit is 10,000 users.

## Security rules

- Admin APIs use the `/admin` namespace and require both session and admin checks.
- Financial and operational endpoints that change data also check `Origin`.
- Important admin changes create audit logs. These keep the actor's name and email as they were at the time.
- Client email, role, workspace, or custom data cannot grant admin access.
- Billing changes require a verified Paddle result and a trusted local account link. Editing a local field alone is not enough.
- List endpoints return only fields needed by the UI. They do not expose credentials, payment details, or raw webhooks.
- A panel error must not silently change customer data or restart an operation.

## Operations

- If Redis or a queue is unavailable, other admin data from PostgreSQL stays available. The affected section shows an unknown state.
- Queue health checks worker presence, the oldest waiting job, active job duration, progress, and recent errors, as well as job counts.
- Separate detail pages show failed operations.
- Support messages and admin notifications use live events, refresh on focus, and limited fallback polling.
- The UI calls the internal `Workspace` a **Customer account**. Code and database fields still use `workspaceId`.
- See [Data retention](DATA_RETENTION.md) for cleanup rules.

## Current limits

The panel does not provide these features:

- Add or remove admins from the UI.
- Set detailed admin roles and permissions.
- Sign in as a customer without their knowledge.
- Edit quotas or database records freely.
- Start refunds or charges directly.
- Manage feature flags, separate email campaigns, or help content.

Add these only when needed, with clear permission, audit, and security rules.

See [Quality checks](backend/docs/quality-checks.md) for live-service checks before production, and [Notifications](backend/docs/notifications.md) for notification and email rules.
