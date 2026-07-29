-- Run this once in the Supabase SQL Editor so Admin Flags actions persist after refresh.
-- Includes admin_action + admin_action_history.

alter table public.flag_reports
  add column if not exists admin_action text;

-- Keep allowed current dispositions (history stores reopen events separately)
alter table public.flag_reports drop constraint if exists flag_reports_admin_action_check;
alter table public.flag_reports
  add constraint flag_reports_admin_action_check
  check (
    admin_action is null
    or admin_action in ('manually_deactivated', 'flag_cleared', 'reviewed', 'reactivated')
  );

alter table public.flag_reports
  add column if not exists admin_action_history jsonb not null default '[]'::jsonb;

update public.flag_reports
set admin_action = 'reviewed'
where reviewed = true
  and admin_action is null;

update public.flag_reports
set admin_action_history = jsonb_build_array(
  jsonb_build_object(
    'action', coalesce(admin_action, 'reviewed'),
    'at', coalesce(created_at, now()),
    'by', 'Admin'
  )
)
where jsonb_array_length(coalesce(admin_action_history, '[]'::jsonb)) = 0
  and (admin_action is not null or reviewed = true);

create index if not exists flag_reports_admin_action_idx
  on public.flag_reports (admin_action, created_at desc);
