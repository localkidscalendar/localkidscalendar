-- Global beta mode config (Stage 1 access code + Stage 2 zip whitelist)

create table if not exists public.beta_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique default 'global',
  enabled boolean not null default false,
  stage1_enabled boolean not null default false,
  access_code text not null default '',
  zip_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.beta_config enable row level security;

-- Anyone can read beta settings (gate + banner are public)
drop policy if exists "Beta config is publicly readable" on public.beta_config;
create policy "Beta config is publicly readable"
  on public.beta_config for select
  using (true);

drop policy if exists "Admins can insert beta config" on public.beta_config;
create policy "Admins can insert beta config"
  on public.beta_config for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update beta config" on public.beta_config;
create policy "Admins can update beta config"
  on public.beta_config for update
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

grant select on public.beta_config to anon, authenticated;
grant insert, update on public.beta_config to authenticated;

insert into public.beta_config (config_key, enabled, stage1_enabled, access_code, zip_codes)
values ('global', false, false, '', '{}')
on conflict (config_key) do nothing;
