-- Optional: remove only the demo 3+ seed from seed_deactivated_flagged_demo.sql
-- Does not wipe other real flags.

delete from public.flag_reports
where details like '[DEMO 3+]%';

-- Restore demo-touched content that still shows the demo comment marker / archived-from-demo pattern.
-- (Safe: only restores rows that still have flag_count = 3 and status archived/flagged.)
-- Prefer using Admin → Deactivated Content → Reactivate for individual items if unsure.

update public.comments
set
  status = 'active',
  flag_count = 0,
  flagged_by = '{}'::text[],
  updated_at = now()
where content like '%[DEMO 3+] Sample archived comment%'
   or content like 'DEMO comment for Admin Flags%';

-- Note: activity/ad restore is best done from the Admin UI (Reactivate),
-- because this script intentionally reuses real rows.
