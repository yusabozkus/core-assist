# Core Asistan Backend

The NestJS application provides the API, business rules, and background workers for Core Asistan. It manages customer accounts, stores, marketplace data, AI answers, billing, notifications, and support.

[Project overview](../README.md) · [Frontend guide](../frontend/README.md)

## Main modules

| Area | Responsibilities |
| --- | --- |
| Accounts and access | Google/Microsoft sign-in, sessions, onboarding, stores, team invitations, and account/store roles |
| Marketplace connections | Trendyol and Hepsiburada connectors, encrypted credentials, mock/live modes, and sync history |
| Catalog and stock | Products, variants, images, prices, size guides, product matching, and stock verification |
| Questions and AI | Question sync, product/store context, Gemini drafts, review rules, automatic replies, and delivery history |
| Billing | Paddle checkout and webhooks, subscriptions, plan changes, usage limits, and account billing permissions |
| Communication | In-app updates, email, browser push, delivery tracking, support tickets, attachments, and contact messages |
| Operations | Admin tools, analytics, audit logs, data cleanup, health checks, and structured logging |

## Application design

Feature modules live in `src/modules/`. Prisma manages PostgreSQL records and transactions. Redis and BullMQ handle background work, including sync, AI drafts, answer delivery, notifications, and cleanup.

The provider registry selects a marketplace connector through shared catalog and question interfaces. To add a marketplace, implement these interfaces, define its credentials and capabilities, and register the connector.

AI drafts use product evidence and store knowledge. Automatic replies also pass application checks for missing information, confidence, stock freshness, and billing limits. Draft ownership and delivery states help control retries and overlapping jobs.

Account permissions, store permissions, and internal admin access are checked separately. Marketplace credentials use AES-256-GCM encryption. Paddle and Resend webhook signatures are verified by the backend.

## Local setup

Use Node.js 22 and Docker with Compose support.

1. Start PostgreSQL and Redis from the repository root:

   ```sh
   docker compose up -d postgres redis
   ```

2. In `backend/`, copy [.env.example](.env.example) to `.env` if the file does not exist. Set these local values:

   ```dotenv
   DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5434/core_assist"
   REDIS_URL="redis://127.0.0.1:6379"
   BETTER_AUTH_URL="http://localhost:4001"
   FRONTEND_URL="http://localhost:3001"
   ```

   If port 6379 is busy, set `REDIS_PORT` in a root `.env` file and use the same port in `REDIS_URL`.

   Set `BETTER_AUTH_SECRET` to a random value of at least 32 characters. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; both are required at startup. Register `http://localhost:4001/api/auth/callback/google` as the Google redirect URI.

3. Install dependencies and start the API from `backend/`:

   ```sh
   npm ci
   npm run db:generate
   npm run db:migrate:deploy
   npm run start:dev
   ```

The API runs at `http://localhost:4001`. Start the [frontend](../frontend/README.md) at `http://localhost:3001` to use the application.

## Configuration

| Feature | Settings |
| --- | --- |
| Local startup | `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Application addresses | `BETTER_AUTH_URL`, `FRONTEND_URL`; leave `AUTH_COOKIE_DOMAIN` empty for localhost |
| Microsoft sign-in | Optional `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`; set both to enable it |
| Internal admin panel | `ADMIN_EMAILS`, a list of verified sign-in email addresses |
| Marketplace mode | `CATALOG_CONNECTOR_MODE` and `QUESTION_CONNECTOR_MODE`: `mock` or `live` |
| AI | `GEMINI_API_KEY` and the model settings in the example file |
| Payments | `PADDLE_ENV`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, and plan price IDs |
| Email | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `NOTIFICATION_EMAIL_FROM` |
| Browser push | VAPID public/private keys and subject |
| Support images | `SUPPORT_B2_*` endpoint, region, bucket, and access keys |

Keep both marketplace modes set to `mock` for local sample data. Live connections need seller credentials, which are added through the application. Use Paddle sandbox settings for local payment tests.

See [.env.example](.env.example) for the full list, including encryption, sync intervals, logging, and retention settings. Keep `.env` outside Git.

### Health and webhooks

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Process health |
| `GET /health/ready` | Application readiness and PostgreSQL/Redis access |
| `POST /billing/webhooks/paddle` | Subscription and payment events |
| `POST /notifications/webhooks/resend` | Email delivery events |

Hookdeck can forward Paddle and Resend webhooks during local development. It is optional for regular UI and API work. The Windows launcher starts separate listeners when the CLI is available; webhook testing also needs the matching provider setup and signing secrets.

## Development commands

Run these commands from `backend/`:

| Command | Purpose |
| --- | --- |
| `npm run start:dev` | Start the API with file watching |
| `npm run check` | Run lint, local tests, and a production build |
| `npm test` | Run local test files |
| `npm run build` | Build the backend |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate` | Create/apply schema changes during development |
| `npm run db:migrate:deploy` | Apply existing migrations |
| `npm run db:studio` | Open Prisma Studio on port 5556 |

The question simulator can add local questions to an existing store:

```sh
npm run simulate:questions -- --provider=trendyol --count=5 --interval=5000
```

This writes application data and can start AI draft jobs when automation is enabled.

## Test scope

Local tests use mocked services or an in-memory PGlite database. They cover areas such as access rules, billing policies, AI draft processing, support image handling, notifications, and request limits. They do not need a running PostgreSQL or Redis service.

Live OAuth, marketplace delivery, BullMQ recovery, payment, and email flows need separate service checks. `npm run check` does not run the smoke, seed, or live AI evaluation scripts.

## Further reading

Detailed implementation notes are currently in Turkish:

- [Billing and Paddle](docs/paddle-billing.md)
- [Notifications and delivery preferences](docs/notifications.md)
- [Email delivery tracking](docs/admin-emails.md)
- [Answer delivery recovery](docs/question-delivery-recovery.md)
- [Test commands and coverage](docs/quality-checks.md)

On Windows, use `npm.cmd` if PowerShell blocks `npm`.
