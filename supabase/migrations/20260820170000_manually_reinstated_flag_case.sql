-- Allow Flagged Users disposition "manually_reinstated" after Admin account reactivation.
-- Also reopen that disposition when a new community user-flag arrives (same as reviewed).

alter table public.profiles drop constraint if exists profiles_user_flag_case_admin_action_check;
alter table public.profiles add constraint profiles_user_flag_case_admin_action_check check (
  user_flag_case_admin_action is null
  or user_flag_case_admin_action in (
    'manually_deactivated',
    'manually_reinstated',
    'reviewed',
    'flags_cleared',
    'unreviewed'
  )
);

-- Repair accounts already reinstated but still stamped manually_deactivated
update public.profiles p
set
  user_flag_case_admin_action = 'manually_reinstated',
  user_flag_case_admin_history = coalesce(p.user_flag_case_admin_history, '[]'::jsonb)
    || jsonb_build_array(
      jsonb_build_object(
        'action', 'manually_reinstated',
        'at', coalesce(
          (
            select max(r.reviewed_at)
            from public.account_reactivation_requests r
            where r.user_id = p.id and r.status = 'reactivated'
          ),
          now()
        ),
        'by', 'Admin',
        'scope', 'account_reactivated',
        'note', 'Backfilled after account reactivation'
      )
    ),
  updated_at = now()
where p.role is distinct from 'disabled'
  and p.user_flag_case_admin_action = 'manually_deactivated'
  and exists (
    select 1
    from public.account_reactivation_requests r
    where r.user_id = p.id
      and r.status = 'reactivated'
  );
