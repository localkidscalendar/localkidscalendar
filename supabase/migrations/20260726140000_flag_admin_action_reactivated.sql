-- Allow sticky "reactivated" disposition on flag_reports (used by Deactivated Content 3+ section)

alter table public.flag_reports
  drop constraint if exists flag_reports_admin_action_check;

alter table public.flag_reports
  add constraint flag_reports_admin_action_check
  check (
    admin_action is null
    or admin_action in (
      'manually_deactivated',
      'flag_cleared',
      'reviewed',
      'reactivated'
    )
  );
