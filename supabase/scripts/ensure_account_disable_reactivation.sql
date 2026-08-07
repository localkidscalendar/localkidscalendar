-- Run in Supabase SQL Editor if migration has not been applied yet.
-- Account disable metadata + reactivation requests

alter table public.profiles
  add column if not exists role_before_disabled text
    check (role_before_disabled is null or role_before_disabled in ('admin', 'organizer', 'community_member')),
  add column if not exists disabled_note text,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users (id) on delete set null;

create table if not exists public.account_reactivation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  sender_name text not null,
  sender_email text not null,
  sender_phone text,
  message text not null,
  status text not null default 'pending'
    check (status in ('pending', 'reactivated', 'declined')),
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists account_reactivation_requests_user_id_idx
  on public.account_reactivation_requests (user_id);

create index if not exists account_reactivation_requests_status_idx
  on public.account_reactivation_requests (status);

create index if not exists account_reactivation_requests_created_at_idx
  on public.account_reactivation_requests (created_at desc);

-- One reactivation request per user (lifetime)
create unique index if not exists account_reactivation_requests_one_per_user_idx
  on public.account_reactivation_requests (user_id);

alter table public.account_reactivation_requests enable row level security;

drop policy if exists "Users can insert own reactivation request" on public.account_reactivation_requests;
create policy "Users can insert own reactivation request"
  on public.account_reactivation_requests for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'disabled'
    )
  );

drop policy if exists "Users can read own reactivation requests" on public.account_reactivation_requests;
create policy "Users can read own reactivation requests"
  on public.account_reactivation_requests for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Admins can read reactivation requests" on public.account_reactivation_requests;
create policy "Admins can read reactivation requests"
  on public.account_reactivation_requests for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update reactivation requests" on public.account_reactivation_requests;
create policy "Admins can update reactivation requests"
  on public.account_reactivation_requests for update
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

grant select, insert on public.account_reactivation_requests to authenticated;
grant update on public.account_reactivation_requests to authenticated;

-- Privilege helper (also defined in ensure_harden_owner_write_guards.sql)
create or replace function public.is_privileged_db_actor()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return true;
  end if;
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    return true;
  end if;
  if auth.uid() is null then
    return true;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
end;
$$;

grant execute on function public.is_privileged_db_actor() to authenticated;
grant execute on function public.is_privileged_db_actor() to service_role;

-- Prevent non-admins from changing their own role / disable / user-flag fields.
-- Exception: incomplete profiles (no zip yet) may choose community_member or organizer once.
-- Keep in sync with ensure_harden_owner_write_guards.sql
create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_db_actor() then
    return new;
  end if;

  -- Non-admins never touch disable metadata
  if new.role_before_disabled is distinct from old.role_before_disabled
     or new.disabled_note is distinct from old.disabled_note
     or new.disabled_at is distinct from old.disabled_at
     or new.disabled_by is distinct from old.disabled_by
  then
    raise exception 'Only admins can change account disable / role fields';
  end if;

  -- Suspension + community user-flag case fields
  if new.user_flag_count is distinct from old.user_flag_count
     or new.user_flagged_by is distinct from old.user_flagged_by
     or new.suspended_at is distinct from old.suspended_at
     or new.user_flag_case_admin_action is distinct from old.user_flag_case_admin_action
     or new.user_flag_case_admin_history is distinct from old.user_flag_case_admin_history
  then
    raise exception 'Only admins or system routines can change user flag / suspension fields';
  end if;

  if new.role is distinct from old.role then
    -- One-time setup: incomplete profiles (no zip yet) may choose CM or Organizer
    if coalesce(nullif(trim(old.zip_code), ''), '') = ''
       and old.role in ('community_member', 'organizer')
       and new.role in ('community_member', 'organizer')
    then
      return new;
    end if;

    raise exception 'Only admins can change account disable / role fields';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_non_admin_role_change on public.profiles;
create trigger profiles_prevent_non_admin_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_non_admin_role_change();

-- Block disabled accounts from creating comments / saved events
create or replace function public.is_account_disabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'disabled'
  );
$$;

drop policy if exists "Authenticated users can create comments" on public.comments;
create policy "Authenticated users can create comments"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = created_by_id
    and not public.is_account_disabled()
  );

drop policy if exists "Users can save events" on public.saved_events;
create policy "Users can save events"
  on public.saved_events for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_account_disabled()
  );
