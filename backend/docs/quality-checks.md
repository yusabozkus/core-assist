# Quality Checks and Test Coverage

Run these commands locally to check lint, tests, and builds. If PowerShell blocks `npm`, use `npm.cmd` instead.

## Commands

In the backend directory:

```sh
npm ci
npm run db:generate
npm run check
```

In the frontend directory:

```sh
npm ci
npm run check
```

| Command | Coverage |
| --- | --- |
| Backend `npm test` | Finds non-integration `.test.ts` and existing `.spec.ts` files under `src`. Add new tests as `.test.ts`. |
| Backend `npm run check` | Lint without changing source files, all unit tests, and a Nest production build. |
| Frontend `npm test` | Runs `scripts/*.test.mjs`, including image security settings and server API checks. |
| Frontend `npm run check` | Lint without changing source files, all frontend tests, and a Next production build with TypeScript checks. |
| Backend `npm run lint:fix` | Optional local command that fixes lint issues. |

Lint requires zero errors and zero warnings. A failed test or shutdown error must return a failure code to the parent command. Test discovery excludes `src/generated`. Finding no tests also fails.

Run `npm audit --omit=dev` separately in each project. `check` does not include this network-based scan. See [Dependency security](dependency-security.md) for past updates and reasons for temporary overrides.

## Local tests

Separate PostgreSQL/Redis integration test files are no longer in this checkout. The runner uses only files that still exist. A successful `check` does not mean that real external service integration passed.

### Support images

- `support-image-lifecycle.test.ts` runs the real image migration in in-memory PGlite/PostgreSQL. It checks existing records, account and ticket deletion, rollback, and blocked attachment after cleanup has claimed an upload.
- `support-attachment.test.ts` uses a mocked B2 client. It checks partial uploads, errors and retries, worker ownership, and deletion of every version for the exact key.

These tests do not use `DATABASE_URL`, Redis, Docker, or real B2. They do not replace a full application test.

### AI drafts and store lifecycle

- `draft-execution.test.ts` runs the lease migration in PGlite. It checks valid ownership, blocked commit or release with an old token, and recovery rollback.
- `question-draft-queue.test.ts` uses mocked Redis job states. It checks orphaned `PROCESSING` jobs, saved `QUEUED` jobs, quota and subscription limits, settings changes, and pagination.
- `question-draft-worker.test.ts` checks that old worker callbacks cannot change a new attempt.
- `store-ai-lifecycle.test.ts` runs real store archive, reopen, and draft services in in-memory PostgreSQL. Model and notification services are mocked. It checks that a late model result after archive cannot save a draft or use quota. Reopening does not restore the old result. Failed archive changes roll back, and another store's generation stays valid.
- Worker tests also check that archived jobs do not generate, send, or create error notifications.

These tests do not use live PostgreSQL, Redis, AI, email, or marketplace services. Test real process crashes and service recovery separately.

## Other important checks

### Concurrent limits

`contact-rate-limit.test.ts` and `support-image-quota.test.ts` run real services in parallel with local transaction lock models. Only requested email, IP, workspace, and ticket locks are shared; transactions are not all placed in one global queue.

They check hourly limits, separate tickets, customer/admin/internal-note races, rollback, access limits, and cleanup of rejected uploads. `atomic-limit-sql.test.ts` runs the real lock SQL and bigint parameters in PGlite. It checks that commit and rollback release advisory locks. PGlite has one connection, so this does not replace a load test with several PostgreSQL processes. No real B2, Redis, or email connection is opened.

### Backend policies

- AI answers: automatic send decisions, missing information, sizes, measurements, and product context, with mocked model replies.
- Subscription and payment methods: account permission, `Origin`, subscription/customer links, end-of-period cancellation, duplicates, and uncertain operations, with a mocked Paddle client.
- Email preferences: defaults, existing opt-outs, quota thresholds, roles, quiet hours, duplicate prevention, and grouped emails. No real emails are sent.
- AI analytics and setup guide: review counts, period and marketplace scope, detail pagination, membership checks, and progress for each user.
- `questions-list.test.ts`: combined search and status filters, filtered totals independent of pagination, and access limits, using fake records.

### Frontend

Server API tests run the real TypeScript clients with local replacements for Next request headers and fetch. They check cookie separation, no cookies on public invitation requests, `no-store`, timeouts, special 404 types, onboarding errors, and empty states without a session. React cache passes calls through in these tests. Validate real Next SSR, caching, and browser behavior separately.

`dashboard-shell.test.mjs` runs the main and support layouts through the shared server component. APIs and client components are mocked. It checks:

- No channel request or setup guide for agents and viewers.
- The active store role in the header.
- Separate store management and account/billing permissions.
- Archived stores, onboarding and session redirects, and accounts without stores.

`list-requests.test.mjs` runs the real request ownership code with delayed results and errors. Old search, pagination, or background requests cannot replace newer list data, cursors, counts, or loading states. It also checks duplicate page loads and results received after the component closes. These tests use no real browser or database.

## Release and live-service checks

This checkout has no quality CI workflow or deployment test scripts. Run the commands above manually, or add them to a new CI setup. Old results in other documents are historical evidence, not current test coverage.

Current local tests do not fully cover every auth or tenant HTTP route, Paddle/Resend signatures, real BullMQ restarts, or marketplace answer delivery.

Before production, validate these in a test environment:

- HTTPS OAuth, sessions, Server Actions, real SSR, and browser behavior.
- Paddle Sandbox checkout, renewal, plan changes, and cancellation.
- Resend webhook signatures, delivery, and admin visibility.
- Browser push on supported devices.
- Marketplace sync and answer delivery, including uncertain results.
- Real queue recovery after process or Redis failure, and graceful SIGTERM shutdown.
- Server load, persistent storage, log redaction, encrypted backups, and off-site restore.

Passing tests does not clear dependency security findings. Review audit results separately.
