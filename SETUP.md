# Local Kids Calendar — New Stack Setup

**Identity:** `localkidscalendar` / `localkidscalendar@gmail.com`  
**Old (do not use):** `ekwatada` / `ekwatada@gmail.com` / Base44 (after cutover)

## Done so far

- [x] Project workspace at `~/Projects/localkidscalendar`
- [x] Base44 export copied in (Vite + React UI + `base44/` schema)
- [x] This repo’s Git author set to `localkidscalendar` / `localkidscalendar@gmail.com`
- [x] GitHub CLI (`gh`) installed at `~/.local/bin/gh`
- [x] Logged into GitHub as **localkidscalendar** (not ekwatada)
- [x] Repo created and pushed: https://github.com/localkidscalendar/localkidscalendar

## Connected

- [x] Vercel project: https://localkidscalendar.vercel.app (team `local-kids-calendar`)
- [x] GitHub repo linked for deploys
- [ ] Supabase API keys in `.env.local` and Vercel env
- [ ] Core SQL schema applied in Supabase

## Add Supabase keys (do this next)

1. Open Supabase → your project → **Project Settings** (gear) → **API**
2. Copy **Project URL** and **anon public** key
3. Paste into `.env.local` (already created in this project):

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

4. In Vercel → Project → **Settings → Environment Variables**, add the same two names/values for Production
5. In Supabase → **SQL Editor**, paste and run the file:

`supabase/migrations/20260722100000_init_core.sql`

Then tell the agent: **“keys added and SQL ran”**

## Migration order

1. Keep Vite frontend for speed (no Next.js rewrite yet)
2. Map remaining `base44/entities` → Supabase tables + auth + RLS
3. Replace `@base44/sdk` calls with Supabase
4. Redeploy on Vercel
5. Confirm feature parity → cancel Base44
