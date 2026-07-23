-- Ad waitlist (Supporters queue for full zip codes)

create table if not exists public.ad_waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_name text,
  email text not null,
  zip_code text not null,
  plan_type text not null default 'monthly' check (plan_type in ('monthly', 'annual')),
  position numeric not null default 1,
  status text not null default 'waiting'
    check (status in ('waiting', 'offered', 'accepted', 'expired', 'declined', 'cancelled')),
  offer_sent_date timestamptz,
  offer_expires_date timestamptz,
  offer_count numeric not null default 0,
  admin_override_notes text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_waitlist_user_id_idx on public.ad_waitlist (user_id);
create index if not exists ad_waitlist_zip_status_idx on public.ad_waitlist (zip_code, status);
create index if not exists ad_waitlist_status_idx on public.ad_waitlist (status);

-- One active queue entry per user per zip
create unique index if not exists ad_waitlist_user_zip_active_uidx
  on public.ad_waitlist (user_id, zip_code)
  where status in ('waiting', 'offered', 'accepted');

alter table public.ad_waitlist enable row level security;

drop policy if exists "Users read own waitlist" on public.ad_waitlist;
create policy "Users read own waitlist"
  on public.ad_waitlist for select
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Users insert own waitlist" on public.ad_waitlist;
create policy "Users insert own waitlist"
  on public.ad_waitlist for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners and admins update waitlist" on public.ad_waitlist;
create policy "Owners and admins update waitlist"
  on public.ad_waitlist for update
  using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Admins delete waitlist" on public.ad_waitlist;
create policy "Admins delete waitlist"
  on public.ad_waitlist for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

grant select, insert, update on public.ad_waitlist to authenticated;
grant delete on public.ad_waitlist to authenticated;
