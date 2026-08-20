-- Community user flagging + account suspension (separate from content flags).
-- 3+ distinct flaggers → suspend (guest actions, digests off, ads/content stay).
-- Manual Disable uses existing admin-disable-user path.
-- Clear Flags / withdraw below 3 → unsuspend.

-- ---------------------------------------------------------------------------
-- Profiles: user-flag counters + suspension
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists user_flag_count numeric not null default 0;

alter table public.profiles
  add column if not exists user_flagged_by text[] not null default '{}';

alter table public.profiles
  add column if not exists suspended_at timestamptz;

alter table public.profiles
  add column if not exists user_flag_case_admin_action text;

alter table public.profiles
  add column if not exists user_flag_case_admin_history jsonb not null default '[]'::jsonb;

do $$
begin
  alter table public.profiles drop constraint if exists profiles_user_flag_case_admin_action_check;
  alter table public.profiles add constraint profiles_user_flag_case_admin_action_check check (
    user_flag_case_admin_action is null
    or user_flag_case_admin_action in (
      'manually_deactivated', 'reviewed', 'flags_cleared', 'unreviewed'
    )
  );
exception when others then
  null;
end;
$$;

create index if not exists profiles_user_flag_count_idx
  on public.profiles (user_flag_count desc)
  where user_flag_count > 0;

create index if not exists profiles_suspended_at_idx
  on public.profiles (suspended_at)
  where suspended_at is not null;

-- ---------------------------------------------------------------------------
-- flag_reports: allow target_type user + user-flag reasons
-- ---------------------------------------------------------------------------
alter table public.flag_reports drop constraint if exists flag_reports_target_type_check;
alter table public.flag_reports add constraint flag_reports_target_type_check
  check (target_type in ('event', 'comment', 'ad', 'user'));

alter table public.flag_reports drop constraint if exists flag_reports_reason_check;
alter table public.flag_reports add constraint flag_reports_reason_check
  check (reason in (
    'inaccurate', 'inappropriate', 'spam', 'other',
    'misrepresented_user', 'disregard_rules'
  ));

-- ---------------------------------------------------------------------------
-- Action block: disabled OR suspended
-- ---------------------------------------------------------------------------
create or replace function public.is_account_action_blocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'disabled'
        or p.suspended_at is not null
      )
  );
$$;

grant execute on function public.is_account_action_blocked() to authenticated;
grant execute on function public.is_account_action_blocked() to anon;
grant execute on function public.is_account_action_blocked() to service_role;

-- Keep is_account_disabled for callers; also treat suspended as blocked for writes
create or replace function public.is_account_disabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_account_action_blocked();
$$;

-- ---------------------------------------------------------------------------
-- Notify flagged user (1 / 2 / 3+)
-- ---------------------------------------------------------------------------
create or replace function public.notify_owner_user_flag_lifecycle(
  p_owner_id uuid,
  p_event text,
  p_flag_count numeric default null,
  p_reason text default null,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count numeric := coalesce(p_flag_count, 0);
  v_reason text;
  v_subject text;
  v_body text;
  v_template text;
  v_details text := nullif(trim(coalesce(p_details, '')), '');
begin
  if p_owner_id is null then
    return null;
  end if;

  v_reason := case lower(coalesce(p_reason, ''))
    when 'misrepresented_user' then 'Misrepresented User'
    when 'disregard_rules' then 'Disregard for Our Community Rules'
    when 'other' then 'Other'
    else nullif(initcap(replace(coalesce(p_reason, ''), '_', ' ')), '')
  end;

  if p_event = 'flagged' then
    if v_count >= 3 then
      v_template := 'user_suspended_flags';
      v_subject := 'Your account has been suspended for review';
      v_body := format(
        E'Your account was flagged by community members (%s of 3) and has been suspended pending Admin review.\n\nReason: %s%s\n\nWhile suspended you can still sign in and read My Messages, but you cannot post, comment, flag, favorite, or save. Digests are turned off. Your public activities and comments remain visible, and any running ads continue.\n\nAn Admin will review soon.',
        trim(to_char(v_count, '999')),
        coalesce(v_reason, 'Not specified'),
        case when v_details is null then '' else E'\nDetails: ' || v_details end
      );
    else
      v_template := 'user_flagged';
      v_subject := 'Your account was flagged';
      v_body := format(
        E'Your account was flagged by a community member (%s of 3).\n\nReason: %s%s\n\nPlease review how you present yourself on Local Kids Calendar. Additional flags may suspend your account for Admin review.',
        trim(to_char(v_count, '999')),
        coalesce(v_reason, 'Not specified'),
        case when v_details is null then '' else E'\nDetails: ' || v_details end
      );
    end if;

  elsif p_event = 'withdrawn' then
    v_template := 'user_flag_withdrawn';
    v_subject := 'A flag on your account was withdrawn';
    v_body := format(
      E'A community flag on your account was withdrawn. Current flags: %s of 3.%s',
      trim(to_char(v_count, '999')),
      case
        when v_count < 3 then E'\n\nIf your account was suspended, it has been reinstated for normal use. Weekly digests stay Off — turn them back on anytime in Account → Notifications if you want them.'
        else ''
      end
    );

  elsif p_event = 'cleared' then
    v_template := 'user_flags_cleared';
    v_subject := 'Flags on your account were cleared';
    v_body :=
      E'An Admin cleared community flag(s) on your account and reinstated normal access. Further flags could suspend your account again for review.\n\nWeekly digests stay Off — turn them back on anytime in Account → Notifications if you want them.';

  elsif p_event = 'partial_cleared' then
    v_template := 'user_flag_partial_cleared';
    v_subject := 'A flag on your account was cleared';
    v_body := format(
      E'An Admin cleared a community flag on your account. Current flags: %s of 3.%s',
      trim(to_char(v_count, '999')),
      case
        when v_count < 3 then E'\n\nIf your account was suspended, it has been reinstated for normal use. Weekly digests stay Off — turn them back on anytime in Account → Notifications if you want them.'
        else ''
      end
    );

  else
    return null;
  end if;

  return public.create_user_message(
    p_owner_id,
    v_subject,
    v_body,
    v_template,
    'system',
    null,
    null,
    'profile',
    p_owner_id,
    null,
    jsonb_build_object(
      'channels', jsonb_build_array('in_app'),
      'flag_count', v_count,
      'flag_event', p_event,
      'reason', p_reason
    )
  );
end;
$$;

grant execute on function public.notify_owner_user_flag_lifecycle(uuid, text, numeric, text, text) to service_role;

create or replace function public.admin_notify_owner_user_flag_lifecycle(
  p_owner_id uuid,
  p_event text,
  p_flag_count numeric default null,
  p_reason text default null,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Admin only';
  end if;
  return public.notify_owner_user_flag_lifecycle(
    p_owner_id, p_event, p_flag_count, p_reason, p_details
  );
end;
$$;

grant execute on function public.admin_notify_owner_user_flag_lifecycle(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.admin_notify_owner_user_flag_lifecycle(uuid, text, numeric, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Notify users who favorited an organizer/poster when account is disabled
-- ---------------------------------------------------------------------------
create or replace function public.notify_favoriters_organizer_removed(
  p_poster_user_id uuid,
  p_reason text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
  v_count int := 0;
  r record;
  v_body text;
begin
  if p_poster_user_id is null then
    return 0;
  end if;

  select coalesce(
    nullif(trim(o.org_name), ''),
    nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''),
    nullif(p.email, ''),
    'an organizer'
  )
  into v_label
  from public.profiles p
  left join public.organizers o on o.user_id = p.id
  where p.id = p_poster_user_id;

  v_body := format(
    'An organizer you favorited ("%s") is no longer available on Local Kids Calendar.%s',
    coalesce(v_label, 'an organizer'),
    case
      when nullif(trim(coalesce(p_reason, '')), '') is null then ''
      else E'\n\nNote: ' || trim(p_reason)
    end
  );

  for r in
    select distinct f.user_id
    from public.favorite_organizers f
    where f.user_id is not null
      and (
        f.poster_user_id = p_poster_user_id
        or f.organizer_id in (
          select o.id from public.organizers o where o.user_id = p_poster_user_id
        )
      )
  loop
    perform public.create_user_message(
      r.user_id,
      'A favorited organizer was removed',
      v_body,
      'favorited_organizer_removed',
      'system',
      'View Saved Organizers',
      '/account?tab=saved-organizers',
      'profile',
      p_poster_user_id,
      null,
      jsonb_build_object('organizer_label', v_label)
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.notify_favoriters_organizer_removed(uuid, text) from public;
grant execute on function public.notify_favoriters_organizer_removed(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Suspend / unsuspend helpers
-- ---------------------------------------------------------------------------
create or replace function public.apply_user_flag_suspension(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  update public.profiles
  set suspended_at = coalesce(suspended_at, now()),
      updated_at = now()
  where id = p_user_id
    and role <> 'disabled'
    and suspended_at is null;

  insert into public.notification_preferences (user_id, frequency, updated_at)
  values (p_user_id, 'none', now())
  on conflict (user_id) do update
    set frequency = 'none',
        updated_at = now();
end;
$$;

create or replace function public.clear_user_flag_suspension(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  update public.profiles
  set suspended_at = null,
      updated_at = now()
  where id = p_user_id
    and suspended_at is not null
    and role <> 'disabled';
end;
$$;

grant execute on function public.apply_user_flag_suspension(uuid) to service_role;
grant execute on function public.clear_user_flag_suspension(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- submit_user_flag
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Patch withdraw_flag to support target_type = user
-- (recreate full function from latest + user branch)
-- ---------------------------------------------------------------------------

create or replace function public.withdraw_user_flag(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_report_id uuid;
  v_flagged_by text[];
  v_count numeric;
  v_was_suspended boolean := false;
  v_restored boolean := false;
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

  select fr.id
  into v_report_id
  from public.flag_reports fr
  where fr.reporter_id = v_uid
    and fr.target_type = 'user'
    and fr.target_id = p_target_user_id
  limit 1;

  if v_report_id is null then
    raise exception 'No flag to remove';
  end if;

  delete from public.flag_reports where id = v_report_id;

  select
    coalesce(p.user_flagged_by, '{}'),
    coalesce(p.user_flag_count, 0),
    (p.suspended_at is not null)
  into v_flagged_by, v_count, v_was_suspended
  from public.profiles p
  where p.id = p_target_user_id;

  if not found then
    return jsonb_build_object('flag_count', 0, 'restored', false);
  end if;

  v_flagged_by := array_remove(v_flagged_by, v_uid::text);
  v_count := coalesce(cardinality(v_flagged_by), 0);

  update public.profiles
  set user_flag_count = v_count,
      user_flagged_by = v_flagged_by,
      updated_at = now()
  where id = p_target_user_id;

  if v_count < 3 and v_was_suspended then
    perform public.clear_user_flag_suspension(p_target_user_id);
    v_restored := true;
  end if;

  perform public.notify_owner_user_flag_lifecycle(
    p_target_user_id, 'withdrawn', v_count, null, null
  );

  return jsonb_build_object(
    'flag_count', v_count,
    'restored', v_restored
  );
end;
$$;

grant execute on function public.withdraw_user_flag(uuid) to authenticated;
grant execute on function public.withdraw_user_flag(uuid) to service_role;

-- Also allow withdraw_flag(..., 'user') by resolving to withdraw_user_flag
create or replace function public.withdraw_flag(p_target_type text, p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_asset_id uuid;
  v_report_id uuid;
  v_flagged_by text[];
  v_count numeric;
  v_status text;
  v_case_action text;
  v_manually boolean := false;
  v_restored boolean := false;
  v_owner_id uuid;
  v_item_label text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if public.is_account_action_blocked() then
    raise exception 'Account restricted';
  end if;

  if p_target_type = 'user' then
    return public.withdraw_user_flag(p_target_id);
  end if;

  if p_target_type not in ('event', 'comment', 'ad') then
    raise exception 'Invalid target type';
  end if;

  if p_target_type = 'ad' then
    if exists (select 1 from public.ad_library a where a.id = p_target_id and a.deleted_at is null) then
      v_asset_id := p_target_id;
    else
      select b.ad_library_id into v_asset_id
      from public.banner_ads b
      where b.id = p_target_id;
    end if;

    if v_asset_id is null then
      raise exception 'Ad asset not found';
    end if;

    select fr.id into v_report_id
    from public.flag_reports fr
    where fr.reporter_id = v_uid and fr.target_type = 'ad' and fr.target_id = v_asset_id
    limit 1;

    if v_report_id is null then
      raise exception 'No flag to remove';
    end if;

    delete from public.flag_reports where id = v_report_id;

    select coalesce(a.flagged_by, '{}'), coalesce(a.flag_count, 0), a.moderation_status,
           a.flag_case_admin_action, a.user_id, coalesce(nullif(trim(a.ad_name), ''), 'your ad creative')
    into v_flagged_by, v_count, v_status, v_case_action, v_owner_id, v_item_label
    from public.ad_library a
    where a.id = v_asset_id and a.deleted_at is null;

    if not found then
      return jsonb_build_object('flag_count', 0, 'restored', false, 'asset_id', v_asset_id);
    end if;

    v_flagged_by := array_remove(v_flagged_by, v_uid::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);

    update public.ad_library set flag_count = v_count, flagged_by = v_flagged_by, updated_at = now() where id = v_asset_id;
    update public.banner_ads set flag_count = v_count, flagged_by = v_flagged_by, updated_at = now() where ad_library_id = v_asset_id;

    v_manually := coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (select 1 from public.flag_reports fr where fr.target_type = 'ad' and fr.target_id = v_asset_id and fr.admin_action = 'manually_deactivated');

    if v_count < 3 and v_status = 'flagged' and not v_manually then
      perform public.reactivate_ad_asset(v_asset_id);
      v_restored := true;
    end if;

    perform public.notify_owner_flag_lifecycle(v_owner_id, 'ad', v_asset_id, 'withdrawn', v_count, null, null, v_item_label);
    return jsonb_build_object('flag_count', v_count, 'restored', v_restored, 'asset_id', v_asset_id);
  end if;

  select fr.id into v_report_id
  from public.flag_reports fr
  where fr.reporter_id = v_uid and fr.target_type = p_target_type and fr.target_id = p_target_id
  limit 1;

  if v_report_id is null then
    raise exception 'No flag to remove';
  end if;

  delete from public.flag_reports where id = v_report_id;

  if p_target_type = 'event' then
    select coalesce(e.flagged_by, '{}'), coalesce(e.flag_count, 0), e.status, e.flag_case_admin_action,
           e.created_by_id, coalesce(nullif(trim(e.title), ''), 'your activity')
    into v_flagged_by, v_count, v_status, v_case_action, v_owner_id, v_item_label
    from public.events e where e.id = p_target_id;

    if not found then
      return jsonb_build_object('flag_count', 0, 'restored', false);
    end if;

    v_flagged_by := array_remove(v_flagged_by, v_uid::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);
    v_manually := coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (select 1 from public.flag_reports fr where fr.target_type = 'event' and fr.target_id = p_target_id and fr.admin_action = 'manually_deactivated');

    update public.events
    set flag_count = v_count, flagged_by = v_flagged_by,
        status = case when v_count < 3 and status = 'archived' and not v_manually then 'active' else status end,
        updated_at = now()
    where id = p_target_id;

    v_restored := (v_count < 3 and v_status = 'archived' and not v_manually);
    perform public.notify_owner_flag_lifecycle(v_owner_id, 'event', p_target_id, 'withdrawn', v_count, null, null, v_item_label);
  else
    select coalesce(c.flagged_by, '{}'), coalesce(c.flag_count, 0), c.status, c.flag_case_admin_action,
           c.created_by_id, left(coalesce(nullif(trim(c.content), ''), 'your comment'), 80)
    into v_flagged_by, v_count, v_status, v_case_action, v_owner_id, v_item_label
    from public.comments c where c.id = p_target_id;

    if not found then
      return jsonb_build_object('flag_count', 0, 'restored', false);
    end if;

    v_flagged_by := array_remove(v_flagged_by, v_uid::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);
    v_manually := coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (select 1 from public.flag_reports fr where fr.target_type = 'comment' and fr.target_id = p_target_id and fr.admin_action = 'manually_deactivated');

    update public.comments
    set flag_count = v_count, flagged_by = v_flagged_by,
        status = case when v_count < 3 and status = 'archived' and not v_manually then 'active' else status end,
        updated_at = now()
    where id = p_target_id;

    v_restored := (v_count < 3 and v_status = 'archived' and not v_manually);
    perform public.notify_owner_flag_lifecycle(v_owner_id, 'comment', p_target_id, 'withdrawn', v_count, null, null, v_item_label);
  end if;

  return jsonb_build_object('flag_count', v_count, 'restored', coalesce(v_restored, false));
end;
$$;

grant execute on function public.withdraw_flag(text, uuid) to authenticated;
grant execute on function public.withdraw_flag(text, uuid) to service_role;

-- After this script, also re-run ensure_flag_auto_hide_override.sql so submit_flag
-- uses is_account_action_blocked() for suspended reporters.
