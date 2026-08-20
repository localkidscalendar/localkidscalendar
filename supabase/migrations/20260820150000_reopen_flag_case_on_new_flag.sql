-- Reopen Admin flag cases when a new community flag arrives after Reviewed / Clear Flags.
-- Fixes: Flagged Users (and content) stayed "Reviewed" with no open badge after a later flag.
-- Run in Supabase SQL Editor if needed: supabase/scripts/ensure_reopen_flag_case_on_new_flag.sql

create or replace function public.submit_user_flag(
  p_target_user_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_contributor text;
  v_flagged_by text[];
  v_count numeric;
  v_new_count numeric;
  v_role text;
  v_suspended boolean := false;
  v_reopen_entry jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_account_action_blocked() then
    raise exception 'Account restricted';
  end if;

  if p_target_user_id is null then
    raise exception 'Invalid user';
  end if;

  if p_target_user_id = v_uid then
    raise exception 'You cannot flag yourself';
  end if;

  if p_reason not in ('misrepresented_user', 'disregard_rules', 'other') then
    raise exception 'Invalid reason';
  end if;

  if nullif(trim(coalesce(p_details, '')), '') is null then
    raise exception 'Details required';
  end if;

  if exists (
    select 1 from public.flag_reports
    where reporter_id = v_uid and target_type = 'user' and target_id = p_target_user_id
  ) then
    raise exception 'You already flagged this user';
  end if;

  select
    p.role,
    coalesce(p.user_flagged_by, '{}'),
    coalesce(p.user_flag_count, 0),
    coalesce(
      nullif(trim(o.org_name), ''),
      nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''),
      nullif(p.email, ''),
      'Member'
    )
  into v_role, v_flagged_by, v_count, v_contributor
  from public.profiles p
  left join public.organizers o on o.user_id = p.id
  where p.id = p_target_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  if v_role = 'disabled' then
    raise exception 'User not found';
  end if;

  if v_role = 'admin' then
    raise exception 'You cannot flag an Admin';
  end if;

  select coalesce(
    (select nullif(trim(o.org_name), '') from public.organizers o where o.user_id = v_uid limit 1),
    nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''),
    nullif(p.email, ''),
    'Member'
  )
  into v_name
  from public.profiles p
  where p.id = v_uid;

  if v_uid::text = any (v_flagged_by) then
    raise exception 'You already flagged this user';
  end if;

  v_new_count := v_count + 1;
  v_flagged_by := array_append(v_flagged_by, v_uid::text);
  v_suspended := v_new_count >= 3;
  v_reopen_entry := jsonb_build_object(
    'action', 'unreviewed',
    'at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'by', 'System',
    'note', 'New community flag'
  );

  insert into public.flag_reports (
    target_type, target_id, reason, details, reporter_id, reporter_name, target_contributor_name
  ) values (
    'user',
    p_target_user_id,
    p_reason,
    trim(p_details),
    v_uid,
    v_name,
    v_contributor
  );

  update public.profiles
  set user_flag_count = v_new_count,
      user_flagged_by = v_flagged_by,
      -- history first so CASE still sees the prior action (Postgres uses new values for columns already assigned in SET)
      user_flag_case_admin_history = case
        when user_flag_case_admin_action in ('reviewed', 'flags_cleared') then
          coalesce(user_flag_case_admin_history, '[]'::jsonb) || jsonb_build_array(v_reopen_entry)
        else user_flag_case_admin_history
      end,
      user_flag_case_admin_action = case
        when user_flag_case_admin_action in ('reviewed', 'flags_cleared') then null
        else user_flag_case_admin_action
      end,
      updated_at = now()
  where id = p_target_user_id;

  if v_suspended then
    perform public.apply_user_flag_suspension(p_target_user_id);
  end if;

  perform public.notify_owner_user_flag_lifecycle(
    p_target_user_id, 'flagged', v_new_count, p_reason, p_details
  );

  return jsonb_build_object(
    'flag_count', v_new_count,
    'suspended', v_suspended
  );
end;
$$;

grant execute on function public.submit_user_flag(uuid, text, text) to authenticated;
grant execute on function public.submit_user_flag(uuid, text, text) to service_role;

-- Content flags: same reopen behavior on events / comments / ad assets
create or replace function public.submit_flag(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_contributor text;
  v_item_label text;
  v_owner_id uuid;
  v_flagged_by text[];
  v_count numeric;
  v_new_count numeric;
  v_archived boolean := false;
  v_exempt boolean := false;
  v_disable jsonb;
  v_asset_id uuid;
  v_banner_id uuid;
  v_moderation text;
  v_report_id uuid;
  v_reopen_entry jsonb;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_account_action_blocked() then
    raise exception 'Account restricted';
  end if;

  if p_target_type not in ('event', 'comment', 'ad') then
    raise exception 'Invalid target type';
  end if;

  if p_target_type = 'ad' then
    if p_reason not in ('inappropriate', 'spam', 'other') then
      raise exception 'Invalid reason';
    end if;
  else
    if p_reason not in ('inaccurate', 'inappropriate', 'spam', 'other') then
      raise exception 'Invalid reason';
    end if;
  end if;

  if p_reason = 'other' and nullif(trim(coalesce(p_details, '')), '') is null then
    raise exception 'Details required for other';
  end if;

  select coalesce(
    (select nullif(trim(o.org_name), '') from public.organizers o where o.user_id = v_uid limit 1),
    nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''),
    nullif(p.email, ''),
    'Member'
  )
  into v_name
  from public.profiles p
  where p.id = v_uid;

  if p_target_type = 'event' then
    if exists (
      select 1 from public.flag_reports
      where reporter_id = v_uid and target_type = p_target_type and target_id = p_target_id
    ) then
      raise exception 'You already flagged this item';
    end if;

    select
      coalesce(e.flagged_by, '{}'),
      coalesce(e.flag_count, 0),
      e.created_by_id,
      coalesce(
        nullif(trim(e.org_name), ''),
        (select nullif(trim(o.org_name), '') from public.organizers o where o.user_id = e.created_by_id limit 1),
        (select nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), '')
           from public.profiles p where p.id = e.created_by_id),
        nullif(e.title, ''),
        'Activity'
      ),
      coalesce(nullif(trim(e.title), ''), 'your activity'),
      coalesce(e.flag_auto_hide_exempt, false)
    into v_flagged_by, v_count, v_owner_id, v_contributor, v_item_label, v_exempt
    from public.events e
    where e.id = p_target_id and e.status = 'active';
    if not found then raise exception 'Event not found or not active'; end if;

  elsif p_target_type = 'comment' then
    if exists (
      select 1 from public.flag_reports
      where reporter_id = v_uid and target_type = p_target_type and target_id = p_target_id
    ) then
      raise exception 'You already flagged this item';
    end if;

    select
      coalesce(c.flagged_by, '{}'),
      coalesce(c.flag_count, 0),
      c.created_by_id,
      coalesce(
        nullif(trim(c.author_name), ''),
        (select nullif(trim(o.org_name), '') from public.organizers o where o.user_id = c.created_by_id limit 1),
        (select nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), '')
           from public.profiles p where p.id = c.created_by_id),
        'Comment'
      ),
      left(coalesce(nullif(trim(c.content), ''), 'your comment'), 80),
      coalesce(c.flag_auto_hide_exempt, false)
    into v_flagged_by, v_count, v_owner_id, v_contributor, v_item_label, v_exempt
    from public.comments c
    where c.id = p_target_id and c.status = 'active';
    if not found then raise exception 'Comment not found or not active'; end if;

  else
    if exists (select 1 from public.ad_library a where a.id = p_target_id and a.deleted_at is null) then
      v_asset_id := p_target_id;
    else
      select b.id, b.ad_library_id
      into v_banner_id, v_asset_id
      from public.banner_ads b
      where b.id = p_target_id;

      if not found then
        raise exception 'Ad not found';
      end if;

      if v_asset_id is null then
        select a.id
        into v_asset_id
        from public.banner_ads b
        join public.ad_library a
          on a.user_id = b.user_id
         and a.image_url = b.image_url
         and a.link_url = b.link_url
         and a.deleted_at is null
        where b.id = p_target_id
        order by case when a.moderation_status = 'approved' then 0 else 1 end, a.updated_at desc
        limit 1;
      end if;
    end if;

    if v_asset_id is null then
      raise exception 'Ad asset not found';
    end if;

    if exists (
      select 1 from public.flag_reports
      where reporter_id = v_uid
        and target_type = 'ad'
        and target_id = v_asset_id
    ) then
      raise exception 'You already flagged this item';
    end if;

    select
      coalesce(a.flagged_by, '{}'),
      coalesce(a.flag_count, 0),
      a.user_id,
      a.moderation_status,
      coalesce(nullif(trim(a.ad_name), ''), 'Ad'),
      coalesce(nullif(trim(a.ad_name), ''), 'your ad creative'),
      coalesce(a.flag_auto_hide_exempt, false)
    into v_flagged_by, v_count, v_owner_id, v_moderation, v_contributor, v_item_label, v_exempt
    from public.ad_library a
    where a.id = v_asset_id
      and a.deleted_at is null;

    if not found then
      raise exception 'Ad asset not found';
    end if;

    if v_moderation = 'flagged' then
      raise exception 'Ad not found or not active';
    end if;

    if not exists (
      select 1 from public.banner_ads b
      where b.status = 'active'
        and (
          b.ad_library_id = v_asset_id
          or (
            b.user_id = v_owner_id
            and b.image_url = (select image_url from public.ad_library where id = v_asset_id)
            and b.link_url = (select link_url from public.ad_library where id = v_asset_id)
          )
        )
    ) then
      raise exception 'Ad not found or not active';
    end if;

    v_report_id := v_asset_id;
  end if;

  if v_owner_id is not null and v_owner_id = v_uid then
    raise exception 'You cannot flag your own content';
  end if;

  if v_uid::text = any (v_flagged_by) then
    raise exception 'You already flagged this item';
  end if;

  v_new_count := v_count + 1;
  v_flagged_by := array_append(v_flagged_by, v_uid::text);
  v_archived := (v_new_count >= 3) and not coalesce(v_exempt, false);
  v_reopen_entry := jsonb_build_object(
    'action', 'unreviewed',
    'at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'by', 'System',
    'note', 'New community flag'
  );

  if p_target_type <> 'ad' then
    v_report_id := p_target_id;
  end if;

  insert into public.flag_reports (
    target_type, target_id, reason, details, reporter_id, reporter_name, target_contributor_name
  ) values (
    p_target_type,
    v_report_id,
    p_reason,
    nullif(trim(coalesce(p_details, '')), ''),
    v_uid,
    v_name,
    v_contributor
  );

  if p_target_type = 'event' then
    update public.events
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        status = case when v_archived then 'archived' else status end,
        -- history first so CASE still sees the prior action (Postgres uses new values for columns already assigned in SET)
        flag_case_admin_history = case
          when flag_case_admin_action in ('reviewed', 'flags_cleared') then
            coalesce(flag_case_admin_history, '[]'::jsonb) || jsonb_build_array(v_reopen_entry)
          else flag_case_admin_history
        end,
        flag_case_admin_action = case
          when flag_case_admin_action in ('reviewed', 'flags_cleared') then null
          else flag_case_admin_action
        end,
        updated_at = now()
    where id = v_report_id;

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'event', v_report_id, 'flagged',
      v_new_count, p_reason, p_details, v_item_label, v_archived
    );

  elsif p_target_type = 'comment' then
    update public.comments
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        status = case when v_archived then 'archived' else status end,
        -- history first so CASE still sees the prior action (Postgres uses new values for columns already assigned in SET)
        flag_case_admin_history = case
          when flag_case_admin_action in ('reviewed', 'flags_cleared') then
            coalesce(flag_case_admin_history, '[]'::jsonb) || jsonb_build_array(v_reopen_entry)
          else flag_case_admin_history
        end,
        flag_case_admin_action = case
          when flag_case_admin_action in ('reviewed', 'flags_cleared') then null
          else flag_case_admin_action
        end,
        updated_at = now()
    where id = v_report_id;

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'comment', v_report_id, 'flagged',
      v_new_count, p_reason, p_details, v_item_label, v_archived
    );

  else
    update public.ad_library
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        -- history first so CASE still sees the prior action (Postgres uses new values for columns already assigned in SET)
        flag_case_admin_history = case
          when flag_case_admin_action in ('reviewed', 'flags_cleared') then
            coalesce(flag_case_admin_history, '[]'::jsonb) || jsonb_build_array(v_reopen_entry)
          else flag_case_admin_history
        end,
        flag_case_admin_action = case
          when flag_case_admin_action in ('reviewed', 'flags_cleared') then null
          else flag_case_admin_action
        end,
        updated_at = now()
    where id = v_report_id;

    update public.banner_ads
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        updated_at = now()
    where ad_library_id = v_report_id;

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'ad', v_report_id, 'flagged',
      v_new_count, p_reason, p_details, v_item_label, v_archived
    );

    if v_archived then
      v_disable := public.disable_ad_asset(
        v_report_id,
        'Ad creative flagged by 3+ community members and disabled across all zip placements.'
      );
      return jsonb_build_object(
        'flag_count', v_new_count,
        'archived', true,
        'asset_disabled', true,
        'asset_id', v_report_id,
        'zip_codes', coalesce(v_disable->'zip_codes', '[]'::jsonb),
        'user_id', v_disable->'user_id',
        'business_name', v_disable->'business_name',
        'asset_ids', coalesce(v_disable->'asset_ids', '[]'::jsonb),
        'banner_ids', coalesce(v_disable->'banner_ids', '[]'::jsonb),
        'needs_notify', not coalesce((v_disable->>'already_disabled')::boolean, false)
      );
    end if;

    return jsonb_build_object(
      'flag_count', v_new_count,
      'archived', false,
      'asset_id', v_report_id
    );
  end if;

  return jsonb_build_object('flag_count', v_new_count, 'archived', v_archived);
end;
$$;

grant execute on function public.submit_flag(text, uuid, text, text) to authenticated;
grant execute on function public.submit_flag(text, uuid, text, text) to service_role;

-- Repair cases already stuck Reviewed after a later uncleared flag
do $$
declare
  v_entry jsonb := jsonb_build_object(
    'action', 'unreviewed',
    'at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'by', 'System',
    'note', 'Reopened: newer community flag after Reviewed'
  );
begin
  update public.profiles p
  set
    user_flag_case_admin_action = null,
    user_flag_case_admin_history = coalesce(p.user_flag_case_admin_history, '[]'::jsonb) || jsonb_build_array(v_entry),
    updated_at = now()
  where p.user_flag_case_admin_action in ('reviewed', 'flags_cleared')
    and exists (
      select 1
      from public.flag_reports fr
      where fr.target_type = 'user'
        and fr.target_id = p.id
        and coalesce(fr.admin_action, '') <> 'flag_cleared'
        and fr.created_at > coalesce((
          select max((e->>'at')::timestamptz)
          from jsonb_array_elements(coalesce(p.user_flag_case_admin_history, '[]'::jsonb)) e
          where e->>'action' in ('reviewed', 'flags_cleared')
        ), timestamptz '1970-01-01')
    );

  update public.events e
  set
    flag_case_admin_action = null,
    flag_case_admin_history = coalesce(e.flag_case_admin_history, '[]'::jsonb) || jsonb_build_array(v_entry),
    updated_at = now()
  where e.flag_case_admin_action in ('reviewed', 'flags_cleared')
    and exists (
      select 1
      from public.flag_reports fr
      where fr.target_type = 'event'
        and fr.target_id = e.id
        and coalesce(fr.admin_action, '') <> 'flag_cleared'
        and fr.created_at > coalesce((
          select max((x->>'at')::timestamptz)
          from jsonb_array_elements(coalesce(e.flag_case_admin_history, '[]'::jsonb)) x
          where x->>'action' in ('reviewed', 'flags_cleared')
        ), timestamptz '1970-01-01')
    );

  update public.comments c
  set
    flag_case_admin_action = null,
    flag_case_admin_history = coalesce(c.flag_case_admin_history, '[]'::jsonb) || jsonb_build_array(v_entry),
    updated_at = now()
  where c.flag_case_admin_action in ('reviewed', 'flags_cleared')
    and exists (
      select 1
      from public.flag_reports fr
      where fr.target_type = 'comment'
        and fr.target_id = c.id
        and coalesce(fr.admin_action, '') <> 'flag_cleared'
        and fr.created_at > coalesce((
          select max((x->>'at')::timestamptz)
          from jsonb_array_elements(coalesce(c.flag_case_admin_history, '[]'::jsonb)) x
          where x->>'action' in ('reviewed', 'flags_cleared')
        ), timestamptz '1970-01-01')
    );

  update public.ad_library a
  set
    flag_case_admin_action = null,
    flag_case_admin_history = coalesce(a.flag_case_admin_history, '[]'::jsonb) || jsonb_build_array(v_entry),
    updated_at = now()
  where a.flag_case_admin_action in ('reviewed', 'flags_cleared')
    and exists (
      select 1
      from public.flag_reports fr
      where fr.target_type = 'ad'
        and fr.target_id = a.id
        and coalesce(fr.admin_action, '') <> 'flag_cleared'
        and fr.created_at > coalesce((
          select max((x->>'at')::timestamptz)
          from jsonb_array_elements(coalesce(a.flag_case_admin_history, '[]'::jsonb)) x
          where x->>'action' in ('reviewed', 'flags_cleared')
        ), timestamptz '1970-01-01')
    );
end $$;
