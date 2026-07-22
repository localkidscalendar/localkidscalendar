-- Improve signup profile creation from auth metadata
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
