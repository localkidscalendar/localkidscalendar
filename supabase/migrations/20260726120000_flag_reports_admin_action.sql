-- Admin Flags: track disposition without deleting reports (keeps user My Flagged history)

alter table public.flag_reports
  add column if not exists admin_action text
  check (admin_action is null or admin_action in ('manually_deactivated', 'flag_cleared', 'reviewed'));

-- Migrate legacy soft-dismiss
update public.flag_reports
set admin_action = 'reviewed'
where reviewed = true
  and admin_action is null;

create index if not exists flag_reports_admin_action_idx
  on public.flag_reports (admin_action, created_at desc);
