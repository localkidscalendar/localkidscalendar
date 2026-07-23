-- Map Google OAuth metadata into profiles on signup

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_first text;
  v_last text;
begin
  v_full_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), '')
  );
  v_first := coalesce(
    nullif(trim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'given_name'), ''),
    case when v_full_name is not null then split_part(v_full_name, ' ', 1) else '' end
  );
  v_last := coalesce(
    nullif(trim(new.raw_user_meta_data->>'last_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'family_name'), ''),
    case
      when v_full_name is not null and position(' ' in v_full_name) > 0
        then trim(substr(v_full_name, position(' ' in v_full_name) + 1))
      else ''
    end
  );

  insert into public.profiles (id, email, role, first_name, last_name, zip_code)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'community_member'),
    coalesce(v_first, ''),
    coalesce(v_last, ''),
    coalesce(new.raw_user_meta_data->>'zip_code', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case
      when public.profiles.role in ('admin', 'organizer', 'community_member', 'disabled')
        then public.profiles.role
      else coalesce(excluded.role, public.profiles.role)
    end,
    first_name = coalesce(nullif(excluded.first_name, ''), public.profiles.first_name),
    last_name = coalesce(nullif(excluded.last_name, ''), public.profiles.last_name),
    zip_code = coalesce(nullif(excluded.zip_code, ''), public.profiles.zip_code),
    updated_at = now();
  return new;
end;
$$;
