-- Atomic Admin Clear Flag / Clear Flags (content + users).
-- Same product behavior as the multi-step Admin UI path, in one transaction.

create or replace function public.admin_flag_actor_label()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''),
    nullif(p.email, ''),
    'Admin'
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function public.admin_stamp_flag_cleared(
  p_report_id uuid,
  p_scope text,
  p_admin_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.flag_reports
  set admin_action = 'flag_cleared',
      reviewed = true,
      admin_action_history = coalesce(admin_action_history, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'action', 'flag_cleared',
          'at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'by', p_admin_name,
          'scope', p_scope
        )
      )
  where id = p_report_id
    and coalesce(admin_action, '') is distinct from 'flag_cleared';
end;
$$;

-- Clear one content or user flag report (Admin Clear Flag)
create or replace function public.admin_clear_flag(
  p_flag_id uuid,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin_name text;
  v_report public.flag_reports%rowtype;
  v_scope text;
  v_flagged_by text[];
  v_count numeric;
  v_status text;
  v_case_action text;
  v_exempt boolean := false;
  v_manually boolean := false;
  v_owner_id uuid;
  v_item_label text;
  v_was_suspended boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'admin'
  ) then
    raise exception 'Admin only';
  end if;

  if p_flag_id is null then
    raise exception 'Flag report required';
  end if;

  select * into v_report from public.flag_reports where id = p_flag_id;
  if not found then
    raise exception 'Flag report not found';
  end if;

  if coalesce(v_report.admin_action, '') = 'flag_cleared' then
    raise exception 'Flag already cleared';
  end if;

  v_admin_name := coalesce(public.admin_flag_actor_label(), 'Admin');
  v_scope := case when v_report.target_type = 'user' then 'flagged_user' else 'flagged_content' end;

  perform public.admin_stamp_flag_cleared(p_flag_id, v_scope, v_admin_name);

  if v_report.target_type = 'user' then
    select
      coalesce(p.user_flagged_by, '{}'),
      coalesce(p.user_flag_count, 0),
      (p.suspended_at is not null)
    into v_flagged_by, v_count, v_was_suspended
    from public.profiles p
    where p.id = v_report.target_id;

    if not found then
      raise exception 'User not found';
    end if;

    -- Recount from uncleared reports (source of truth)
    select coalesce(array_agg(fr.reporter_id::text order by fr.created_at), '{}'::text[])
    into v_flagged_by
    from public.flag_reports fr
    where fr.target_type = 'user'
      and fr.target_id = v_report.target_id
      and coalesce(fr.admin_action, '') is distinct from 'flag_cleared';

    v_count := coalesce(cardinality(v_flagged_by), 0);

    update public.profiles
    set user_flag_count = v_count,
        user_flagged_by = v_flagged_by,
        suspended_at = case when v_count < 3 then null else suspended_at end,
        updated_at = now()
    where id = v_report.target_id;

    perform public.notify_owner_user_flag_lifecycle(
      v_report.target_id, 'partial_cleared', v_count, null, p_details
    );

    return jsonb_build_object(
      'ok', true,
      'target_type', 'user',
      'target_id', v_report.target_id,
      'flag_count', v_count,
      'unsuspended', (v_count < 3 and v_was_suspended)
    );
  end if;

  if v_report.target_type not in ('event', 'comment', 'ad') then
    raise exception 'Unsupported target type';
  end if;

  if v_report.target_type = 'event' then
    select coalesce(e.flagged_by, '{}'), coalesce(e.flag_count, 0), e.status,
           e.flag_case_admin_action, coalesce(e.flag_auto_hide_exempt, false),
           e.created_by_id, coalesce(nullif(trim(e.title), ''), 'your activity')
    into v_flagged_by, v_count, v_status, v_case_action, v_exempt, v_owner_id, v_item_label
    from public.events e where e.id = v_report.target_id;
    if not found then raise exception 'Activity not found'; end if;

    v_flagged_by := array_remove(v_flagged_by, v_report.reporter_id::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);
    v_manually := coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (
        select 1 from public.flag_reports fr
        where fr.target_type = 'event' and fr.target_id = v_report.target_id
          and fr.admin_action = 'manually_deactivated'
      );

    update public.events
    set flag_count = v_count,
        flagged_by = v_flagged_by,
        status = case
          when v_count >= 3 and not v_exempt and status is distinct from 'archived' then 'archived'
          when v_count < 3 and status = 'archived' and not v_manually then 'active'
          else status
        end,
        updated_at = now()
    where id = v_report.target_id;

  elsif v_report.target_type = 'comment' then
    select coalesce(c.flagged_by, '{}'), coalesce(c.flag_count, 0), c.status,
           c.flag_case_admin_action, coalesce(c.flag_auto_hide_exempt, false),
           c.created_by_id, left(coalesce(nullif(trim(c.content), ''), 'your comment'), 80)
    into v_flagged_by, v_count, v_status, v_case_action, v_exempt, v_owner_id, v_item_label
    from public.comments c where c.id = v_report.target_id;
    if not found then raise exception 'Comment not found'; end if;

    v_flagged_by := array_remove(v_flagged_by, v_report.reporter_id::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);
    v_manually := coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (
        select 1 from public.flag_reports fr
        where fr.target_type = 'comment' and fr.target_id = v_report.target_id
          and fr.admin_action = 'manually_deactivated'
      );

    update public.comments
    set flag_count = v_count,
        flagged_by = v_flagged_by,
        status = case
          when v_count >= 3 and not v_exempt and status is distinct from 'archived' then 'archived'
          when v_count < 3 and status = 'archived' and not v_manually then 'active'
          else status
        end,
        updated_at = now()
    where id = v_report.target_id;

  else
    select coalesce(a.flagged_by, '{}'), coalesce(a.flag_count, 0), a.moderation_status,
           a.flag_case_admin_action, coalesce(a.flag_auto_hide_exempt, false),
           a.user_id, coalesce(nullif(trim(a.ad_name), ''), 'your ad creative')
    into v_flagged_by, v_count, v_status, v_case_action, v_exempt, v_owner_id, v_item_label
    from public.ad_library a
    where a.id = v_report.target_id and a.deleted_at is null;
    if not found then raise exception 'Ad asset not found'; end if;

    v_flagged_by := array_remove(v_flagged_by, v_report.reporter_id::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);
    v_manually := coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (
        select 1 from public.flag_reports fr
        where fr.target_type = 'ad' and fr.target_id = v_report.target_id
          and fr.admin_action = 'manually_deactivated'
      );

    update public.ad_library
    set flag_count = v_count, flagged_by = v_flagged_by, updated_at = now()
    where id = v_report.target_id;
    update public.banner_ads
    set flag_count = v_count, flagged_by = v_flagged_by, updated_at = now()
    where ad_library_id = v_report.target_id;

    if v_count >= 3 and not v_exempt and v_status is distinct from 'flagged' then
      perform public.disable_ad_asset(
        v_report.target_id,
        'Ad creative flagged by 3+ community members and disabled across all zip placements.'
      );
    elsif v_count < 3 and v_status = 'flagged' and not v_manually then
      perform public.reactivate_ad_asset(v_report.target_id);
    end if;
  end if;

  if v_owner_id is not null then
    perform public.notify_owner_flag_lifecycle(
      v_owner_id, v_report.target_type, v_report.target_id, 'partial_cleared',
      v_count, null, p_details, v_item_label, null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'target_type', v_report.target_type,
    'target_id', v_report.target_id,
    'flag_count', v_count
  );
end;
$$;

-- Clear all uncleared flags on a target (Admin Clear Flags)
create or replace function public.admin_clear_all_flags(
  p_target_type text,
  p_target_id uuid,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin_name text;
  v_scope text;
  v_cleared int := 0;
  r record;
  v_owner_id uuid;
  v_item_label text;
  v_status text;
  v_history jsonb;
  v_entry_cleared jsonb;
  v_entry_reviewed jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'admin'
  ) then
    raise exception 'Admin only';
  end if;

  if p_target_type not in ('event', 'comment', 'ad', 'user') or p_target_id is null then
    raise exception 'Invalid target';
  end if;

  v_admin_name := coalesce(public.admin_flag_actor_label(), 'Admin');
  v_scope := case when p_target_type = 'user' then 'flagged_user' else 'flagged_content' end;

  for r in
    select fr.id
    from public.flag_reports fr
    where fr.target_type = p_target_type
      and fr.target_id = p_target_id
      and coalesce(fr.admin_action, '') is distinct from 'flag_cleared'
  loop
    perform public.admin_stamp_flag_cleared(r.id, v_scope, v_admin_name);
    v_cleared := v_cleared + 1;
  end loop;

  if v_cleared = 0 then
    raise exception 'No flags to clear';
  end if;

  v_entry_cleared := jsonb_build_object(
    'action', 'flags_cleared', 'at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'by', v_admin_name,
    'scope', case when p_target_type = 'user' then 'flagged_user' else 'deactivated_content' end
  );
  v_entry_reviewed := jsonb_build_object(
    'action', 'reviewed', 'at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'by', v_admin_name,
    'scope', case when p_target_type = 'user' then 'flagged_user' else 'deactivated_content' end
  );

  if p_target_type = 'user' then
    select coalesce(p.user_flag_case_admin_history, '[]'::jsonb)
    into v_history
    from public.profiles p where p.id = p_target_id;
    if not found then raise exception 'User not found'; end if;

    update public.profiles
    set user_flag_count = 0,
        user_flagged_by = '{}'::text[],
        suspended_at = null,
        user_flag_case_admin_history = coalesce(v_history, '[]'::jsonb) || jsonb_build_array(v_entry_cleared, v_entry_reviewed),
        user_flag_case_admin_action = 'reviewed',
        updated_at = now()
    where id = p_target_id;

    perform public.notify_owner_user_flag_lifecycle(
      p_target_id, 'cleared', 0, null, p_details
    );

    return jsonb_build_object(
      'ok', true,
      'target_type', 'user',
      'target_id', p_target_id,
      'flag_count', 0,
      'cleared_reports', v_cleared
    );
  end if;

  if p_target_type = 'event' then
    select e.created_by_id, coalesce(nullif(trim(e.title), ''), 'your activity'), e.status,
           coalesce(e.flag_case_admin_history, '[]'::jsonb)
    into v_owner_id, v_item_label, v_status, v_history
    from public.events e where e.id = p_target_id;
    if not found then raise exception 'Activity not found'; end if;

    update public.events
    set flag_count = 0,
        flagged_by = '{}'::text[],
        flag_auto_hide_exempt = false,
        flag_case_admin_history = coalesce(v_history, '[]'::jsonb) || jsonb_build_array(v_entry_cleared, v_entry_reviewed),
        flag_case_admin_action = 'reviewed',
        status = case when status in ('archived', 'deleted') then 'active' else status end,
        updated_at = now()
    where id = p_target_id;

  elsif p_target_type = 'comment' then
    select c.created_by_id, left(coalesce(nullif(trim(c.content), ''), 'your comment'), 80), c.status,
           coalesce(c.flag_case_admin_history, '[]'::jsonb)
    into v_owner_id, v_item_label, v_status, v_history
    from public.comments c where c.id = p_target_id;
    if not found then raise exception 'Comment not found'; end if;

    update public.comments
    set flag_count = 0,
        flagged_by = '{}'::text[],
        flag_auto_hide_exempt = false,
        flag_case_admin_history = coalesce(v_history, '[]'::jsonb) || jsonb_build_array(v_entry_cleared, v_entry_reviewed),
        flag_case_admin_action = 'reviewed',
        status = case when status = 'archived' then 'active' else status end,
        updated_at = now()
    where id = p_target_id;

  else
    select a.user_id, coalesce(nullif(trim(a.ad_name), ''), 'your ad creative'), a.moderation_status,
           coalesce(a.flag_case_admin_history, '[]'::jsonb)
    into v_owner_id, v_item_label, v_status, v_history
    from public.ad_library a
    where a.id = p_target_id and a.deleted_at is null;
    if not found then raise exception 'Ad asset not found'; end if;

    update public.ad_library
    set flag_count = 0,
        flagged_by = '{}'::text[],
        flag_auto_hide_exempt = false,
        flag_case_admin_history = coalesce(v_history, '[]'::jsonb) || jsonb_build_array(v_entry_cleared, v_entry_reviewed),
        flag_case_admin_action = 'reviewed',
        updated_at = now()
    where id = p_target_id;

    update public.banner_ads
    set flag_count = 0, flagged_by = '{}'::text[], updated_at = now()
    where ad_library_id = p_target_id;

    perform public.reactivate_ad_asset(p_target_id);
  end if;

  if v_owner_id is not null then
    perform public.notify_owner_flag_lifecycle(
      v_owner_id, p_target_type, p_target_id, 'cleared',
      0, null, p_details, v_item_label, null
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'target_type', p_target_type,
    'target_id', p_target_id,
    'flag_count', 0,
    'cleared_reports', v_cleared
  );
end;
$$;

grant execute on function public.admin_clear_flag(uuid, text) to authenticated;
grant execute on function public.admin_clear_flag(uuid, text) to service_role;
grant execute on function public.admin_clear_all_flags(text, uuid, text) to authenticated;
grant execute on function public.admin_clear_all_flags(text, uuid, text) to service_role;

-- Helpers are for internal use by the clear RPCs (same owner / security definer).
revoke all on function public.admin_flag_actor_label() from public, anon, authenticated;
revoke all on function public.admin_stamp_flag_cleared(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_flag_actor_label() to service_role;
grant execute on function public.admin_stamp_flag_cleared(uuid, text, text) to service_role;
