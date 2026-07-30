-- Allow first-time account-type selection during incomplete profile setup.
-- Google/OAuth users are created as community_member with an empty zip; choosing
-- Organizer on the Account setup screen must be allowed once. After zip is set,
-- non-admins still cannot change role or disable metadata.

create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
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
