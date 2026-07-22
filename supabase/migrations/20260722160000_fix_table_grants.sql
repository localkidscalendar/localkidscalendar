-- Ensure API roles can use the tables we created via SQL Editor.
-- Without these grants, Supabase returns "permission denied for table ..."

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.profiles to anon;

grant select, insert, update, delete on public.organizers to authenticated;
grant select on public.organizers to anon;

grant select, insert, update, delete on public.events to authenticated;
grant select on public.events to anon;

-- Keep profiles readable for authenticated users (needed by event policies)
drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
create policy "Profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Allow public read of active-event policy checks without failing on profiles
drop policy if exists "Profiles are readable publicly for role checks" on public.profiles;
create policy "Profiles are readable publicly for role checks"
  on public.profiles for select
  to anon
  using (true);
