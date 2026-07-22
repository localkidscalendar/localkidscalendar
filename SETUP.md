# Local Kids Calendar — New Stack Setup

**Identity:** `localkidscalendar` / `localkidscalendar@gmail.com`  
**Old (do not use):** `ekwatada` / `ekwatada@gmail.com` / Base44 (after cutover)

## Done so far

- [x] Project workspace at `~/Projects/localkidscalendar`
- [x] Base44 export copied in (Vite + React UI + `base44/` schema)
- [x] This repo’s Git author set to `localkidscalendar` / `localkidscalendar@gmail.com`
- [x] GitHub CLI (`gh`) installed at `~/.local/bin/gh`

## Your next steps (accounts)

### 1. Confirm Cursor

Cursor should be signed in as **localkidscalendar@gmail.com**.

### 2. Log in to GitHub CLI as the new account

In Terminal (this project folder):

```bash
export PATH="$HOME/.local/bin:$PATH"
gh auth login
```

Choose:

- GitHub.com
- HTTPS
- Login with a web browser
- Use the **localkidscalendar** GitHub user (or the org owner account with that email)

Then verify:

```bash
gh auth status
gh api user --jq '.login'
gh org list
```

Expected: login is **not** `ekwatada`. Org should include **localkidscalendar** (or whatever exact org name you created).

### 3. Create org repo + first push

After you’re logged in, tell the agent: **“GitHub login done — create the repo and push.”**

They will:

1. Create `localkidscalendar/localkidscalendar` (org/repo) if needed  
2. Commit the export  
3. Push to the new remote (not `ekwatada/localkidscalendar`)

### 4. Supabase + Vercel (same email)

Create free accounts / projects under **localkidscalendar@gmail.com**:

- [Supabase](https://supabase.com) → New project (e.g. `localkidscalendar`)
- [Vercel](https://vercel.com) → Import the GitHub org repo

Then tell the agent: **“Supabase and Vercel accounts are ready.”**

## Migration order (after accounts)

1. Keep Vite frontend for speed (no Next.js rewrite yet)
2. Map `base44/entities` → Supabase tables + auth + RLS
3. Replace `@base44/sdk` calls with Supabase
4. Deploy on Vercel
5. Confirm feature parity → cancel Base44

## Note on global Git identity

Only **this repo** was updated to the new author. Your machine-wide Git config may still say `ekwatada`. To change it later (optional):

```bash
git config --global user.name "localkidscalendar"
git config --global user.email "localkidscalendar@gmail.com"
```
