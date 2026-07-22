-- Core schema for Local Kids Calendar (ported from Base44 entities)
-- Run in Supabase → SQL Editor if not applying via CLI.

create extension if not exists "pgcrypto";

-- Profiles extend auth.users (Base44 User entity)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'community_member'
    check (role in ('admin', 'organizer', 'community_member')),
  is_advertiser boolean not null default false,
  first_name text,
  last_name text,
  zip_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, first_name, last_name, zip_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'community_member'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'zip_code', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    role = coalesce(excluded.role, public.profiles.role),
    first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name),
    last_name = coalesce(nullif(excluded.last_name, ''), public.profiles.last_name),
    zip_code = coalesce(nullif(excluded.zip_code, ''), public.profiles.zip_code),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Organizers
create table if not exists public.organizers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  org_name text not null,
  org_description text,
  org_logo text,
  org_website text,
  org_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizers_user_id_idx on public.organizers (user_id);

alter table public.organizers enable row level security;

create policy "Organizers are publicly readable"
  on public.organizers for select
  using (true);

create policy "Users can create own organizer"
  on public.organizers for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Owners and admins can update organizers"
  on public.organizers for update
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Admins can delete organizers"
  on public.organizers for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Events / activities
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_by_id uuid references public.profiles (id) on delete set null,
  title text not null,
  description text not null,
  category text[] not null default '{}',
  subcategory text[] not null default '{}',
  classifications jsonb not null default '[]'::jsonb,
  age_min numeric,
  age_max numeric,
  start_date date not null,
  end_date date,
  registration_start date,
  registration_end date,
  registration_full boolean not null default false,
  recurring text not null default 'none'
    check (recurring in ('none', 'daily', 'weekly', 'monthly')),
  time_start text,
  time_end text,
  location_name text,
  address text,
  city text not null,
  state text not null,
  zip_code text not null,
  latitude numeric,
  longitude numeric,
  cost text,
  contact_name text,
  contact_email text,
  contact_phone text,
  website text,
  event_image text,
  org_logo text,
  org_name text,
  org_description text,
  posted_by_role text check (posted_by_role in ('community_member', 'organizer')),
  poster_display_name text,
  flag_count numeric not null default 0,
  flagged_by text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'deleted', 'expired', 'archived')),
  save_count numeric not null default 0,
  view_count numeric not null default 0,
  impression_count numeric not null default 0,
  keywords text,
  admin_notes text,
  image_moderation_status text not null default 'approved'
    check (
      image_moderation_status in (
        'pending',
        'approved',
        'declined',
        'manual_review',
        'manual_review_declined'
      )
    ),
  image_moderation_notes text,
  image_moderation_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_status_idx on public.events (status);
create index if not exists events_zip_code_idx on public.events (zip_code);
create index if not exists events_start_date_idx on public.events (start_date);
create index if not exists events_created_by_id_idx on public.events (created_by_id);

alter table public.events enable row level security;

create policy "Active events are publicly readable"
  on public.events for select
  using (
    status = 'active'
    or auth.uid() = created_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Authenticated users can create events"
  on public.events for insert
  to authenticated
  with check (auth.uid() = created_by_id);

create policy "Owners and admins can update events"
  on public.events for update
  to authenticated
  using (
    auth.uid() = created_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Owners and admins can delete events"
  on public.events for delete
  to authenticated
  using (
    auth.uid() = created_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );
