-- Preferred search radius for signed-in users (Home defaults to profile zip + this distance).

alter table public.profiles
  add column if not exists radius_miles integer not null default 15;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_radius_miles_check'
  ) then
    alter table public.profiles
      add constraint profiles_radius_miles_check
      check (radius_miles > 0 and radius_miles <= 100);
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, first_name, last_name, zip_code, radius_miles)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'community_member'),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(new.raw_user_meta_data->>'zip_code', ''),
    coalesce(nullif(new.raw_user_meta_data->>'radius_miles', '')::integer, 15)
  )
  on conflict (id) do update set
    email = excluded.email,
    role = coalesce(excluded.role, public.profiles.role),
    first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name),
    last_name = coalesce(nullif(excluded.last_name, ''), public.profiles.last_name),
    zip_code = coalesce(nullif(excluded.zip_code, ''), public.profiles.zip_code),
    radius_miles = coalesce(
      nullif(new.raw_user_meta_data->>'radius_miles', '')::integer,
      public.profiles.radius_miles,
      15
    ),
    updated_at = now();
  return new;
end;
$$;
