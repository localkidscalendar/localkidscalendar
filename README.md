# Local Kids Calendar

Community activity calendar with Supporter advertising. The live site runs on **Vercel** (frontend + `/api/*` serverless routes) and **Supabase** (auth, Postgres, storage).

Production: [https://localkidscalendar.com](https://localkidscalendar.com)

## Prerequisites

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local` and fill in Supabase keys (see below).

## Run locally

Start the Vite dev server:

```bash
npm run dev
```

Open the URL printed in the terminal (typically `http://localhost:5173`).

On localhost, `/api/*` requests are proxied to the production deployment unless you set `VITE_API_BASE_URL` in `.env.local`. For most UI work against production data/APIs, the default is fine.

## Environment variables

**Client (`.env.local`, also set in Vercel for Production):**

```bash
VITE_SUPABASE_URL=https://auth.localkidscalendar.com
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

Optional:

- `VITE_API_BASE_URL` — override API host when developing off localhost (see `.env.example`).
- `VITE_APP_URL` — public site URL for client-side links.

**Server (Vercel Project → Settings → Environment Variables only — never commit):**

See `.env.example` for Stripe, Resend, OpenAI, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and related keys used by `/api/*` routes and Vercel crons (`vercel.json`).

Never commit `.env.local` or secrets.

## Database

SQL migrations live in `supabase/migrations/`. Production changes are often applied via the Supabase SQL Editor; one-off ensure scripts are in `supabase/scripts/`.

## Deploy

Push to `main` on GitHub. Vercel builds and deploys automatically (`npm run build`).

After schema or env changes, confirm Vercel and Supabase settings match `.env.example` and the Admin Manual (`src/components/admin/AdminManual.jsx`).

## Tests & checks

```bash
npm run lint
npm run test          # Vitest unit tests
npm run test:e2e      # Playwright (requires dev server / config)
npm run build
```

## Project layout

| Path | Purpose |
|------|---------|
| `src/` | React frontend |
| `api/` | Vercel serverless routes (Stripe, email, crons, moderation, admin) |
| `shared/` | Helpers shared by frontend and API |
| `supabase/` | Migrations and SQL ensure scripts |
| `tests/` | Unit and e2e tests |
| `archive/base44-prototype/` | Archived Base44 export (not used at runtime) |

## Agent / contributor notes

See `AGENTS.md` for conventions, key files, and workflow expectations.
