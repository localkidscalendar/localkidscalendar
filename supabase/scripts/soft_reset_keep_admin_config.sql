-- Soft reset before beta soft-launch.
-- Run in Supabase → SQL Editor (as postgres). Do NOT apply as a migration.
--
-- KEEPS
--   - auth user + profile: localkidscalendar@gmail.com (admin)
--   - faqs
--   - admin_default_ads
--   - beta_config (full row)
--   - email_config
--   - ad_pricing_config
--   - event-media files are NOT deleted here (Storage API required).
--     Default-ad images stay in place; leftover user uploads are harmless orphans.
--
-- CLEARS
--   - all other auth users / profiles
--   - events, organizers, comments, saves, favorites
--   - ads library / banner ads / waitlist / discount codes
--   - flags, contact messages, in-app / mass messages
--   - notification prefs, saved filters, reactivation requests
--   - email suppressions, ad_zip_config, ad_pricing_history

do $$
declare
  admin_email constant text := 'localkidscalendar@gmail.com';
  admin_id uuid;
  deleted_users int;
begin
  select id
  into admin_id
  from auth.users
  where lower(email) = lower(admin_email)
  limit 1;

  if admin_id is null then
    raise exception 'Admin user % not found in auth.users — aborting reset', admin_email;
  end if;

  -- Ensure admin profile exists and is admin
  insert into public.profiles (id, email, role)
  values (admin_id, admin_email, 'admin')
  on conflict (id) do update
    set email = excluded.email,
        role = 'admin',
        updated_at = now();

  -- Clear transactional / user data (children first where useful)
  delete from public.flag_reports;
  delete from public.comments;
  delete from public.saved_events;
  delete from public.favorite_organizers;
  delete from public.user_messages;
  delete from public.mass_messages;
  delete from public.notification_preferences;
  delete from public.saved_filters;
  delete from public.account_reactivation_requests;
  delete from public.email_suppressions;
  delete from public.ad_waitlist;
  delete from public.banner_ads;
  delete from public.ad_library;
  delete from public.events;
  delete from public.organizers;
  delete from public.contact_messages;
  delete from public.discount_codes;
  delete from public.ad_zip_config;
  delete from public.ad_pricing_history;

  -- Remove non-admin auth users (cascades remaining profile-owned rows)
  delete from auth.users
  where id <> admin_id;
  get diagnostics deleted_users = row_count;

  raise notice 'Soft reset complete. Kept admin % (%). Deleted % other auth users. Storage left unchanged.',
    admin_email, admin_id, deleted_users;
end $$;

-- Verification
select 'auth_users' as check_name, count(*)::text as value
from auth.users
union all
select 'admin_email', coalesce((select email from auth.users where lower(email) = 'localkidscalendar@gmail.com' limit 1), 'MISSING')
union all
select 'admin_role', coalesce((select p.role from public.profiles p join auth.users u on u.id = p.id where lower(u.email) = 'localkidscalendar@gmail.com' limit 1), 'MISSING')
union all
select 'faqs', count(*)::text from public.faqs
union all
select 'admin_default_ads', count(*)::text from public.admin_default_ads
union all
select 'beta_config', count(*)::text from public.beta_config
union all
select 'beta_zips', coalesce((select array_to_string(zip_codes, ',') from public.beta_config limit 1), '')
union all
select 'email_config', count(*)::text from public.email_config
union all
select 'ad_pricing_config', count(*)::text from public.ad_pricing_config
union all
select 'events', count(*)::text from public.events
union all
select 'profiles', count(*)::text from public.profiles
union all
select 'banner_ads', count(*)::text from public.banner_ads
union all
select 'ad_library', count(*)::text from public.ad_library
union all
select 'event_media_objects', count(*)::text from storage.objects where bucket_id = 'event-media'
order by 1;
