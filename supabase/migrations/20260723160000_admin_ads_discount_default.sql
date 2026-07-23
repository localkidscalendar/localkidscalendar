-- Admin discount codes, default/filler ads, and banner_ads fields for admin panel

alter table public.banner_ads
  add column if not exists discount_amount numeric,
  add column if not exists replacement_required boolean not null default false;

create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent numeric not null check (discount_percent > 0 and discount_percent <= 100),
  plan_type text not null default 'both' check (plan_type in ('monthly', 'annual', 'both')),
  renewals_applicable numeric not null default 1,
  max_uses_per_user numeric not null default 1,
  restricted_email text,
  expires_date date,
  status text not null default 'active' check (status in ('active', 'expired', 'disabled')),
  times_used numeric not null default 0,
  used_by_user_ids text[] not null default '{}',
  used_by_records jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discount_codes_code_idx on public.discount_codes (code);
create index if not exists discount_codes_status_idx on public.discount_codes (status);

create table if not exists public.admin_default_ads (
  id uuid primary key default gen_random_uuid(),
  ad_name text not null,
  image_url text,
  link_url text not null,
  priority numeric not null default 0,
  is_slot_1 boolean not null default false,
  is_slot_2 boolean not null default false,
  is_slot_3 boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_default_ads_status_idx on public.admin_default_ads (status);
create index if not exists admin_default_ads_priority_idx on public.admin_default_ads (priority desc);

alter table public.discount_codes enable row level security;
alter table public.admin_default_ads enable row level security;

-- Discount codes: admin-only
drop policy if exists "Admins manage discount codes" on public.discount_codes;
create policy "Admins manage discount codes"
  on public.discount_codes for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Default ads: public read active; admin manage
drop policy if exists "Active default ads are publicly readable" on public.admin_default_ads;
create policy "Active default ads are publicly readable"
  on public.admin_default_ads for select
  using (status = 'active');

drop policy if exists "Admins manage default ads" on public.admin_default_ads;
create policy "Admins manage default ads"
  on public.admin_default_ads for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

grant select, insert, update, delete on public.discount_codes to authenticated;
grant select on public.admin_default_ads to anon, authenticated;
grant insert, update, delete on public.admin_default_ads to authenticated;
