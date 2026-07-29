-- Record full admin disposition history on each flag report (supports multiple actions over time)

alter table public.flag_reports
  add column if not exists admin_action_history jsonb not null default '[]'::jsonb;

-- Seed history from any existing single admin_action / reviewed disposition
update public.flag_reports
set admin_action_history = jsonb_build_array(
  jsonb_build_object(
    'action', coalesce(admin_action, 'reviewed'),
    'at', coalesce(created_at, now()),
    'by', 'Admin'
  )
)
where jsonb_array_length(admin_action_history) = 0
  and (admin_action is not null or reviewed = true);
