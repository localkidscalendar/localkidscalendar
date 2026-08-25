# Local Kids Calendar — Stack setup (historical)

**Identity:** `localkidscalendar` / `localkidscalendar@gmail.com`

## Current stack (live)

- **Frontend + API:** Vercel — https://localkidscalendar.com
- **Auth + database:** Supabase
- **Repo:** https://github.com/localkidscalendar/localkidscalendar

See `README.md` for local dev, env vars, and deploy. See `AGENTS.md` for contributor conventions.

## Migration status

- [x] Vite + React UI on Vercel
- [x] Supabase auth, Postgres, RLS
- [x] `/api/*` serverless routes (Stripe, Resend, crons, moderation)
- [x] Base44 prototype disabled; export archived at `archive/base44-prototype/`
- [x] `@base44/sdk` removed from the app

For day-to-day work, use `README.md` — this file is a short migration checklist record.
