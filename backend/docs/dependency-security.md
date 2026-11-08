# Dependency Security Review — 27 September 2026

This is a historical record of the review on this date. It is not a current audit result. See [Quality checks](quality-checks.md) for commands to run again.

The first backend scan reported **6 high and 1 moderate** affected packages. These were package counts in the dependency tree, not seven separate bugs that users could reach. After targeted updates, both `npm audit --omit=dev --json` and `npm audit --json` reported **0 findings and exit code 0**.

## Updates and project use

| Dependency path | Change | Project use |
| --- | --- | --- |
| Nest → Multer | `@nestjs/common`, `core`, and `platform-express`: 11.2.3 → **11.2.6**; Multer 2.2.0 → **2.4.0** | Nest is used at runtime. No upload route using Multer or file interceptors was found. The fixed framework dependency was still installed. |
| Express/body-parser → qs | 6.15.3 → **6.16.0**, through a lockfile update within the existing version range | Used for HTTP parsing. No direct dependency or override was added. |
| Prisma → @prisma/config → deepmerge-ts | 7.1.5 → **8.0.2**, with an override only for `@prisma/config@7.10.0` | Used by the CLI to load local `prisma.config.ts`. This is a plain object with schema and datasource settings. Customer input and Map-based merges are not used. |
| Prisma → mysql2 | 3.15.3 → **3.24.4**, with an override only for `prisma@7.10.0` | The app and Better Auth use PostgreSQL/Prisma, with no MySQL connection. Better Auth's compatible optional peer dependency also uses this updated copy. |

The review covered [Nest 11.2.6](https://github.com/nestjs/nest/releases/tag/v11.2.6), the [multipart advisory](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm), the [qs isBuffer DoS advisory](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g), and the [MySQL compressed protocol advisory](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3).

## Why the Prisma overrides exist

Prisma CLI, Client, and PostgreSQL adapter were already **7.10.0** in the lockfile. `package.json` was also pinned to that exact version. No Prisma major version or database schema change was made. The CLI stayed in production dependencies because the production migration service needed it.

Prisma 7.10.0 pinned old config and MySQL dependencies. The two overrides apply only to this version. `deepmerge-ts` 8 is a major update. Its [release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) describe Map merge and type changes. The project's plain config does not use those features. The checks below tested the CLI and database use, but did not cover every Prisma Studio or MySQL case.

When updating Prisma:

- Review CLI, Client, and adapter versions together.
- Remove the overrides when Prisma includes fixed dependencies itself.
- Do not assume an override for an old version applies to a new version.
- Check the lockfile, audit results, code generation, migrations, and integration results again.

## Results recorded on 27 September 2026

- Loading the real `prisma.config.ts` kept the schema path and PostgreSQL datasource. `prisma validate` and `db:generate` passed. A cyclic object merge did not exhaust the stack with the new deepmerge version.
- Backend `check` passed: no lint errors or warnings, **140/140 unit tests**, and a successful Nest build.
- **55/55 integration tests** passed with separate PostgreSQL and Redis test services. All migrations ran on new test databases. These covered auth, tenant access, billing, email, question delivery, AI, and queues. No migration ran on the application database during that review.
- A Node 22 Linux Docker build passed full `npm ci`, runtime `npm ci --omit=dev`, Prisma generation, and Nest build. Both installs reported zero audit findings.
- An isolated production Compose test passed migration and startup checks, PostgreSQL/Redis outage recovery, Redis AOF persistence, Caddy log redaction, and encrypted backup with restore to a separate database. Backend SIGTERM ended with exit code 0 in about 1.8 seconds. Active BullMQ work and an HTTP write finished, and SSE closed before provider disconnect. The test containers were removed afterward.

The deployment files and CI workflow used for those old checks are no longer in this checkout. These results do not describe the current automatic test coverage. Run the current checks and live-service tests before a new release.

The frontend production audit also reported zero findings during that review. A moderate issue in frontend development dependencies was outside this backend update. A zero audit result does not prove that the whole app is secure.
