-- Allow Flags Cleared disposition on 3+ deactivation case history

do $$
declare
  t text;
begin
  foreach t in array array['events', 'comments', 'banner_ads']
  loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_flag_case_admin_action_check');
    execute format(
      'alter table public.%I add constraint %I check (
        flag_case_admin_action is null
        or flag_case_admin_action in (''manually_deactivated'', ''reactivated'', ''reviewed'', ''flags_cleared'')
      )',
      t,
      t || '_flag_case_admin_action_check'
    );
  end loop;
end $$;
