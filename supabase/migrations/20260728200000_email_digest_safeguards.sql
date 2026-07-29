-- Email digest safeguards: pause switch, inactivity tracking, suppression, send stamps.

-- Last activity for inactivity-based digest auto-off
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

update public.profiles
set last_seen_at = coalesce(last_seen_at, updated_at, created_at, now())
where last_seen_at is null;

-- Digest send stamp (idempotency / same-week skip)
alter table public.notification_preferences
  add column if not exists last_digest_sent_at timestamptz;

-- Admin-controlled digest + safeguard settings (mirrors beta_config pattern)
create table if not exists public.email_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique default 'global',
  digests_paused boolean not null default false,
  inactivity_days integer not null default 90
    check (inactivity_days >= 14 and inactivity_days <= 365),
  max_sends_per_run integer not null default 200
    check (max_sends_per_run >= 1 and max_sends_per_run <= 5000),
  paused_at timestamptz,
  paused_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.email_config enable row level security;

drop policy if exists "Email config is publicly readable" on public.email_config;
create policy "Email config is publicly readable"
  on public.email_config for select
  using (true);

drop policy if exists "Admins can insert email config" on public.email_config;
create policy "Admins can insert email config"
  on public.email_config for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update email config" on public.email_config;
create policy "Admins can update email config"
  on public.email_config for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

grant select on public.email_config to anon, authenticated;
grant insert, update on public.email_config to authenticated;

insert into public.email_config (config_key, digests_paused, inactivity_days, max_sends_per_run)
values ('global', false, 90, 200)
on conflict (config_key) do nothing;

-- Bounce / complaint / manual suppression
create table if not exists public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('bounce', 'complaint', 'manual', 'unsubscribe')),
  detail text,
  created_at timestamptz not null default now()
);

create unique index if not exists email_suppressions_email_unique
  on public.email_suppressions (lower(email));

create index if not exists email_suppressions_user_id_idx
  on public.email_suppressions (user_id);

alter table public.email_suppressions enable row level security;

drop policy if exists "Admins can read email suppressions" on public.email_suppressions;
create policy "Admins can read email suppressions"
  on public.email_suppressions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Writes only via service role (webhooks / unsubscribe API)

grant select on public.email_suppressions to authenticated;
