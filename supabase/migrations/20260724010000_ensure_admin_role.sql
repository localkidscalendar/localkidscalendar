-- Ensure the primary site account is admin (safe to re-run)

update public.profiles
set role = 'admin', updated_at = now()
where lower(email) = lower('localkidscalendar@gmail.com')
  and role is distinct from 'admin';
