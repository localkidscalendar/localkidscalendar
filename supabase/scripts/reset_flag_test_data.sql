-- TEST ONLY: clear flag reports and flag counters so you can re-flag content.
-- Run in the Supabase SQL Editor. Do not apply as a production migration.

-- 1) Remove all flag reports (also clears unique one-flag-per-user restriction)
delete from public.flag_reports;

-- 2) Reset flag counters / reporter lists on content
update public.events
set
  flag_count = 0,
  flagged_by = '{}'::text[],
  updated_at = now()
where coalesce(flag_count, 0) <> 0
   or coalesce(cardinality(flagged_by), 0) > 0;

update public.comments
set
  flag_count = 0,
  flagged_by = '{}'::text[],
  updated_at = now()
where coalesce(flag_count, 0) <> 0
   or coalesce(cardinality(flagged_by), 0) > 0;

update public.banner_ads
set
  flag_count = 0,
  flagged_by = '{}'::text[],
  updated_at = now()
where coalesce(flag_count, 0) <> 0
   or coalesce(cardinality(flagged_by), 0) > 0;

-- 3) Restore content that was hidden by flagging / manual deactivate
update public.events
set status = 'active', updated_at = now()
where status = 'archived';

update public.comments
set status = 'active', updated_at = now()
where status = 'archived';

update public.banner_ads
set status = 'active', updated_at = now()
where status = 'flagged';
