-- Promote site admin + allow admins to manage other profiles

-- Allow "disabled" accounts (used by Admin dashboard)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'organizer', 'community_member', 'disabled'));

-- Admins can update any profile (role, advertiser flag, etc.)
drop policy if exists "Admins can update any profile" on public.profiles;
create policy "Admins can update any profile"
  on public.profiles for update
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

-- Promote the admin account (0 rows = that email has not signed up yet)
update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = lower('localkidscalendar@gmail.com');
