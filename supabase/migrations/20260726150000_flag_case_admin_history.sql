-- Isolate Deactivated Content (3+) admin history from per-flag Flagged Content history

alter table public.events
  add column if not exists flag_case_admin_action text
  check (
    flag_case_admin_action is null
    or flag_case_admin_action in ('manually_deactivated', 'reactivated', 'reviewed', 'flags_cleared')
  ),
  add column if not exists flag_case_admin_history jsonb not null default '[]'::jsonb;

alter table public.comments
  add column if not exists flag_case_admin_action text
  check (
    flag_case_admin_action is null
    or flag_case_admin_action in ('manually_deactivated', 'reactivated', 'reviewed', 'flags_cleared')
  ),
  add column if not exists flag_case_admin_history jsonb not null default '[]'::jsonb;

alter table public.banner_ads
  add column if not exists flag_case_admin_action text
  check (
    flag_case_admin_action is null
    or flag_case_admin_action in ('manually_deactivated', 'reactivated', 'reviewed', 'flags_cleared')
  ),
  add column if not exists flag_case_admin_history jsonb not null default '[]'::jsonb;
