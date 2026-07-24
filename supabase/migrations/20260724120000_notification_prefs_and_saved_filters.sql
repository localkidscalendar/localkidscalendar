-- Notification preferences + saved home filters (Account tabs)

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  frequency text not null default 'none'
    check (frequency in ('weekly', 'none')),
  include_fav_organizers boolean not null default false,
  include_other_activities boolean not null default false,
  categories text[] not null default '{}',
  keywords text,
  locations jsonb not null default '[]'::jsonb,
  zip_code text,
  radius_miles numeric not null default 15,
  age_min numeric,
  age_max numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists notification_preferences_frequency_idx
  on public.notification_preferences (frequency);

create table if not exists public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  search text,
  category text not null default 'all',
  subcategory text,
  sort_by text not null default 'posted'
    check (sort_by in ('posted', 'start', 'registration')),
  zip_code text,
  radius_miles numeric not null default 15,
  age_min numeric,
  age_max numeric,
  price_min numeric,
  price_max numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.notification_preferences enable row level security;
alter table public.saved_filters enable row level security;

drop policy if exists "Users manage own notification prefs" on public.notification_preferences;
create policy "Users manage own notification prefs"
  on public.notification_preferences for all
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Users manage own saved filters" on public.saved_filters;
create policy "Users manage own saved filters"
  on public.saved_filters for all
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.saved_filters to authenticated;
grant all on table public.notification_preferences to service_role;
grant all on table public.saved_filters to service_role;
