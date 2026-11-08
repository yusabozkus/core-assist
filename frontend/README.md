# Core Asistan Frontend

The Next.js application provides the public website, customer dashboard, and admin panel for Core Asistan. It uses the App Router with server-rendered pages and client components for interactive tools. The interface is in Turkish and supports light and dark themes.

[Project overview](../README.md) · [Backend guide](../backend/README.md) · [Screenshots](../screens/)

## Application areas

| Area | Screens and tools |
| --- | --- |
| Public website | Product introduction, feature sections, pricing, a question demo, and contact form |
| Sign-in and setup | Google/Microsoft sign-in, onboarding, store setup, and a guided checklist |
| Customer inbox | Question search and filters, product context, AI drafts, manual answers, and delivery history |
| Catalog and inventory | Product cards, compact view, product details, variants, stock filters, and sync history |
| AI tools | Reply modes, writing preferences, store knowledge, FAQs, channel details, and analytics |
| Account management | Team invitations, permissions, profile, notifications, billing, and support conversations |
| Admin panel | Customer accounts, billing, AI usage, queues, system health, support, email tracking, and audit records |

## UI and data handling

Tailwind CSS, Radix UI, and shadcn/ui provide shared components and responsive layouts. Recharts displays analytics; Motion provides UI transitions. Theme settings are managed with `next-themes`.

Feature-specific API clients live in `lib/api/`. Server requests pass the current session cookie to the backend and use `no-store` for user data. Client components handle actions, filters, dialogs, and live updates. Access checks and business rules are enforced by the backend.

## Local setup

Use Node.js 22 and start the [backend](../backend/README.md) first.

1. In `frontend/`, copy [.env.example](.env.example) to `.env.local` if the file does not exist. Set the API address:

   ```dotenv
   NEXT_PUBLIC_API_URL="http://localhost:4001"
   ```

2. Install dependencies and start the app from `frontend/`:

   ```sh
   npm ci
   npm run dev
   ```

Open `http://localhost:3001`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Backend address used by the browser; locally `http://localhost:4001` |
| `API_URL` | Optional backend address for server-side requests; falls back to `NEXT_PUBLIC_API_URL` |
| `NEXT_PUBLIC_PADDLE_ENV` | Paddle environment; use `sandbox` for local payment tests |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Public Paddle client token for checkout |
| `NEXT_PUBLIC_AI_TEST_ENABLED` | Allows the development AI test page in a production-mode build when explicitly enabled |

Payment tests also need the matching Paddle settings in the backend. `NEXT_PUBLIC_*` values are included in the browser build; keep private API keys and webhook secrets in the backend. Restart or rebuild the frontend after changing public settings.

## Project structure

```text
app/          Routes, layouts, loading states, and page entry points
components/   Shared UI, customer features, admin tools, and landing sections
lib/api/      Browser and server API clients
lib/          Session, permissions, billing routes, and shared helpers
types/        Shared feature and API types
constants/    Routes, navigation, and application settings
hooks/        Reusable React hooks
public/       Logos, static images, and notification service worker
scripts/      Local test files
```

Main entry points are `/`, `/login`, `/dashboard`, `/billing`, and `/admin`. Private pages load the current session and direct users through the required sign-in and store setup steps.

## Development commands

Run these commands from `frontend/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server on port 3001 |
| `npm run check` | Run lint, local tests, and a production build |
| `npm run lint` | Check code style and lint rules |
| `npm test` | Run local test files |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Create a production build |
| `npm run test:security` | Check the remote image configuration |

Local tests cover API request behavior, session cookie handling, dashboard layouts, and configuration. They use test doubles for Next.js and external requests. Full browser flows need the running frontend and backend.

The frontend Docker image uses Next.js standalone output. Build dependencies must include development packages because the UI build uses the local shadcn tooling.

## Screen library

The [screen library](../screens/) includes the customer pages and key dialogs in both themes. Open `screens/index.html` from the repository root to browse the local gallery.

On Windows, use `npm.cmd` if PowerShell blocks `npm`.
