-- Allow reporters to withdraw their own community flag (delete report + sync counters).
-- Restores auto-hidden content when the remaining count drops below 3 (unless Admin manually deactivated).

create or replace function public.withdraw_flag(
  p_target_type text,
  p_target_id uuid
)
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
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = v_uid and p.role = 'disabled'
  ) then
    raise exception 'Account disabled';
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

    select fr.id
    into v_report_id
    from public.flag_reports fr
    where fr.reporter_id = v_uid
      and fr.target_type = 'ad'
      and fr.target_id = v_asset_id
    limit 1;

    if v_report_id is null then
      raise exception 'No flag to remove';
    end if;

    delete from public.flag_reports where id = v_report_id;

    select
      coalesce(a.flagged_by, '{}'),
      coalesce(a.flag_count, 0),
      a.moderation_status,
      a.flag_case_admin_action
    into v_flagged_by, v_count, v_status, v_case_action
    from public.ad_library a
    where a.id = v_asset_id
      and a.deleted_at is null;

    if not found then
      return jsonb_build_object('flag_count', 0, 'restored', false, 'asset_id', v_asset_id);
    end if;

    v_flagged_by := array_remove(v_flagged_by, v_uid::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);

    update public.ad_library
    set flag_count = v_count,
        flagged_by = v_flagged_by,
        updated_at = now()
    where id = v_asset_id;

    update public.banner_ads
    set flag_count = v_count,
        flagged_by = v_flagged_by,
        updated_at = now()
    where ad_library_id = v_asset_id;

    v_manually :=
      coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (
        select 1 from public.flag_reports fr
        where fr.target_type = 'ad'
          and fr.target_id = v_asset_id
          and fr.admin_action = 'manually_deactivated'
      );

    if v_count < 3 and v_status = 'flagged' and not v_manually then
      perform public.reactivate_ad_asset(v_asset_id);
      v_restored := true;
    end if;

    return jsonb_build_object(
      'flag_count', v_count,
      'restored', v_restored,
      'asset_id', v_asset_id
    );
  end if;

  select fr.id
  into v_report_id
  from public.flag_reports fr
  where fr.reporter_id = v_uid
    and fr.target_type = p_target_type
    and fr.target_id = p_target_id
  limit 1;

  if v_report_id is null then
    raise exception 'No flag to remove';
  end if;

  delete from public.flag_reports where id = v_report_id;

  if p_target_type = 'event' then
    select
      coalesce(e.flagged_by, '{}'),
      coalesce(e.flag_count, 0),
      e.status,
      e.flag_case_admin_action
    into v_flagged_by, v_count, v_status, v_case_action
    from public.events e
    where e.id = p_target_id;

    if not found then
      return jsonb_build_object('flag_count', 0, 'restored', false);
    end if;

    v_flagged_by := array_remove(v_flagged_by, v_uid::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);

    v_manually :=
      coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (
        select 1 from public.flag_reports fr
        where fr.target_type = 'event'
          and fr.target_id = p_target_id
          and fr.admin_action = 'manually_deactivated'
      );

    update public.events
    set flag_count = v_count,
        flagged_by = v_flagged_by,
        status = case
          when v_count < 3 and status = 'archived' and not v_manually then 'active'
          else status
        end,
        updated_at = now()
    where id = p_target_id;

    v_restored := (v_count < 3 and v_status = 'archived' and not v_manually);

  else
    select
      coalesce(c.flagged_by, '{}'),
      coalesce(c.flag_count, 0),
      c.status,
      c.flag_case_admin_action
    into v_flagged_by, v_count, v_status, v_case_action
    from public.comments c
    where c.id = p_target_id;

    if not found then
      return jsonb_build_object('flag_count', 0, 'restored', false);
    end if;

    v_flagged_by := array_remove(v_flagged_by, v_uid::text);
    v_count := coalesce(cardinality(v_flagged_by), 0);

    v_manually :=
      coalesce(v_case_action, '') = 'manually_deactivated'
      or exists (
        select 1 from public.flag_reports fr
        where fr.target_type = 'comment'
          and fr.target_id = p_target_id
          and fr.admin_action = 'manually_deactivated'
      );

    update public.comments
    set flag_count = v_count,
        flagged_by = v_flagged_by,
        status = case
          when v_count < 3 and status = 'archived' and not v_manually then 'active'
          else status
        end,
        updated_at = now()
    where id = p_target_id;

    v_restored := (v_count < 3 and v_status = 'archived' and not v_manually);
  end if;

  return jsonb_build_object(
    'flag_count', v_count,
    'restored', coalesce(v_restored, false)
  );
end;
$$;

grant execute on function public.withdraw_flag(text, uuid) to authenticated;
grant execute on function public.withdraw_flag(text, uuid) to service_role;
