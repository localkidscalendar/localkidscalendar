-- TEST ONLY: wipe all community flags and flag history so you can re-test from a clean slate.
-- Run in Supabase → SQL Editor (as postgres / service role). Do NOT apply as a migration.
--
-- Clears
--   - flag_reports (activities, comments, ads, users) including Admin History on each report
--   - flag counters, reporter lists, case Admin History, and Override 3+ exemptions
--   - user-flag counters, reporter lists, case history, and 3+ suspensions (not Admin Disable)
--   - in-app flag lifecycle notices
-- Restores
--   - activities/comments auto-hidden by 3 flags (status archived → active)
--   - ad creatives/placements disabled by flags (flagged → active/approved)
-- Does NOT
--   - delete users, activities, comments, or ads
--   - undo Admin Disable (profiles.role = disabled) or Admin-removed activities (status deleted)

begin;

-- 1) All flag reports (content + user). Also clears one-flag-per-user uniqueness.
delete from public.flag_reports;

-- 2) Activity flags + case history
update public.events
set
  flag_count = 0,
  flagged_by = '{}'::text[],
  flag_auto_hide_exempt = false,
  flag_case_admin_action = null,
  flag_case_admin_history = '[]'::jsonb,
  updated_at = now()
where coalesce(flag_count, 0) <> 0
   or coalesce(cardinality(flagged_by), 0) > 0
   or coalesce(flag_auto_hide_exempt, false)
   or flag_case_admin_action is not null
   or coalesce(jsonb_array_length(flag_case_admin_history), 0) > 0;

update public.events
set status = 'active', updated_at = now()
where status = 'archived';

-- 3) Comment flags + case history
update public.comments
set
  flag_count = 0,
  flagged_by = '{}'::text[],
  flag_auto_hide_exempt = false,
  flag_case_admin_action = null,
  flag_case_admin_history = '[]'::jsonb,
  updated_at = now()
where coalesce(flag_count, 0) <> 0
   or coalesce(cardinality(flagged_by), 0) > 0
   or coalesce(flag_auto_hide_exempt, false)
   or flag_case_admin_action is not null
   or coalesce(jsonb_array_length(flag_case_admin_history), 0) > 0;

update public.comments
set status = 'active', updated_at = now()
where status = 'archived';

-- 4) Ad Asset flags (community flags attach to the creative, then cascade to zips)
update public.ad_library
set
  flag_count = 0,
  flagged_by = '{}'::text[],
  flag_auto_hide_exempt = false,
  flag_case_admin_action = null,
  flag_case_admin_history = '[]'::jsonb,
  flagged_at = null,
  disable_notified_at = null,
  moderation_status = case
    when moderation_status = 'flagged' then 'approved'
    else moderation_status
  end,
  updated_at = now()
where coalesce(flag_count, 0) <> 0
   or coalesce(cardinality(flagged_by), 0) > 0
   or coalesce(flag_auto_hide_exempt, false)
   or flag_case_admin_action is not null
   or coalesce(jsonb_array_length(flag_case_admin_history), 0) > 0
   or flagged_at is not null
   or disable_notified_at is not null
   or moderation_status = 'flagged';

update public.banner_ads
set
  flag_count = 0,
  flagged_by = '{}'::text[],
  flag_case_admin_action = null,
  flag_case_admin_history = '[]'::jsonb,
  updated_at = now()
where coalesce(flag_count, 0) <> 0
   or coalesce(cardinality(flagged_by), 0) > 0
   or flag_case_admin_action is not null
   or coalesce(jsonb_array_length(flag_case_admin_history), 0) > 0
   or status = 'flagged';

update public.banner_ads
set
  status = 'active',
  moderation_status = 'approved',
  updated_at = now()
where status = 'flagged';

-- 5) User (account) flags + 3+ suspension. Leaves Admin Disable (role = disabled) alone.
update public.profiles
set
  user_flag_count = 0,
  user_flagged_by = '{}'::text[],
  suspended_at = null,
  user_flag_case_admin_action = null,
  user_flag_case_admin_history = '[]'::jsonb,
  updated_at = now()
where coalesce(user_flag_count, 0) <> 0
   or coalesce(cardinality(user_flagged_by), 0) > 0
   or suspended_at is not null
   or user_flag_case_admin_action is not null
   or coalesce(jsonb_array_length(user_flag_case_admin_history), 0) > 0;

-- 6) Flag-related inbox notices so testers are not looking at leftover flag mail
delete from public.user_messages
where template_key in (
  'activity_flagged',
  'activity_removed_flags',
  'activity_flag_withdrawn',
  'activity_flags_cleared',
  'activity_flag_partial_cleared',
  'activity_flag_overridden',
  'comment_flagged',
  'comment_removed_flags',
  'comment_flag_withdrawn',
  'comment_flags_cleared',
  'comment_flag_partial_cleared',
  'comment_flag_overridden',
  'ad_flagged',
  'ad_flagged_admin',
  'ad_removed_flagged',
  'ad_flag_withdrawn',
  'ad_flags_cleared',
  'ad_flag_partial_cleared',
  'ad_flag_overridden',
  'user_flagged',
  'user_suspended_flags',
  'user_flag_withdrawn',
  'user_flags_cleared',
  'user_flag_partial_cleared'
);

commit;

-- Verification
select 'flag_reports' as check_name, count(*)::text as value from public.flag_reports
union all
select 'events_with_flags', count(*)::text from public.events
  where coalesce(flag_count, 0) > 0 or coalesce(cardinality(flagged_by), 0) > 0
union all
select 'comments_with_flags', count(*)::text from public.comments
  where coalesce(flag_count, 0) > 0 or coalesce(cardinality(flagged_by), 0) > 0
union all
select 'ad_assets_with_flags', count(*)::text from public.ad_library
  where coalesce(flag_count, 0) > 0 or coalesce(cardinality(flagged_by), 0) > 0 or flagged_at is not null
union all
select 'banner_ads_flagged', count(*)::text from public.banner_ads where status = 'flagged'
union all
select 'profiles_with_user_flags', count(*)::text from public.profiles
  where coalesce(user_flag_count, 0) > 0 or suspended_at is not null
union all
select 'events_archived', count(*)::text from public.events where status = 'archived'
union all
select 'comments_archived', count(*)::text from public.comments where status = 'archived'
order by 1;
