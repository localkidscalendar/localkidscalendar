# AGENTS.md

## Project context

Local Kids Calendar — user-owned application code on **Vercel + Supabase**, not Base44. Keep changes focused on the user's request and preserve existing conventions.

Start with `README.md` for local setup, environment variables, and deploy workflow.

## Stack

- **Frontend:** React + Vite + Tailwind (`src/`)
- **Auth & data:** Supabase Auth + Postgres (RLS); client via `@/lib/supabaseClient.js`
- **Server:** Vercel `/api/*` routes (`api/`); privileged DB access via `SUPABASE_SERVICE_ROLE_KEY` in `api/_lib/stripeHelpers.js`
- **Integrations:** Stripe, Resend, OpenAI moderation/vision; crons in `vercel.json`

The archived Base44 prototype lives in `archive/base44-prototype/` and is **not** part of the runtime.

## Key files

- `src/`: frontend application source
- `api/`: Vercel serverless routes (Stripe, Resend, digests, moderation, crons)
- `shared/`: small helpers shared by frontend and API
- `supabase/migrations/`: schema migrations
- `supabase/scripts/`: one-off ensure/repair SQL for production
- `tests/unit/`: Vitest unit tests (`npm run test`)
- `tests/e2e/`: Playwright smoke tests (`npm run test:e2e`)
- `vite.config.js`: Vite config
- `.env.local`: local-only environment values; never commit secrets
- `src/components/admin/AdminManual.jsx`: product/admin workflow reference (update when behavior changes)

## Working notes

- Use `npm run dev` for local frontend development.
- Local `/api` calls use `src/lib/apiBase.js` (production host unless `VITE_API_BASE_URL` is set).
- Do not reintroduce `@base44/sdk` or Base44 CLI workflows.
- Run relevant checks from `package.json` before finishing code changes (`lint`, `test`, `build` as appropriate).
- **Admin Manual:** When product rules, signup/profile flows, or admin workflows change, update `src/components/admin/AdminManual.jsx` in the same change set (standing rule).
