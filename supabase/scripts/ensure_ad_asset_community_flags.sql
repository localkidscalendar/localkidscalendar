-- Community flags attach to Ad Library assets (not per-zip placements).
-- Flags accumulate across zips; at 3 distinct flaggers the creative is disabled everywhere.
-- Also: ads may not use reason "inaccurate".

alter table public.ad_library
  add column if not exists flag_count numeric not null default 0;

alter table public.ad_library
  add column if not exists flagged_by text[] not null default '{}';

alter table public.ad_library
  add column if not exists flag_case_admin_action text;

alter table public.ad_library
  add column if not exists flag_case_admin_history jsonb not null default '[]'::jsonb;

create index if not exists ad_library_flag_count_idx
  on public.ad_library (flag_count desc)
  where coalesce(flag_count, 0) > 0;

-- Remap existing placement-targeted ad reports onto their library asset when possible.
update public.flag_reports fr
set target_id = b.ad_library_id
from public.banner_ads b
where fr.target_type = 'ad'
  and fr.target_id = b.id
  and b.ad_library_id is not null;

-- Recompute asset counters from remapped reports (ignore cleared).
update public.ad_library a
set
  flag_count = coalesce(sub.cnt, 0),
  flagged_by = coalesce(sub.reporters, '{}'),
  updated_at = now()
from (
  select
    fr.target_id as asset_id,
    count(*)::numeric as cnt,
    coalesce(array_agg(distinct fr.reporter_id::text), '{}') as reporters
  from public.flag_reports fr
  where fr.target_type = 'ad'
    and fr.admin_action is distinct from 'flag_cleared'
  group by fr.target_id
) sub
where a.id = sub.asset_id;

-- Mirror asset counts onto placements for Ad Manager display.
update public.banner_ads b
set
  flag_count = coalesce(a.flag_count, 0),
  flagged_by = coalesce(a.flagged_by, '{}'),
  updated_at = now()
from public.ad_library a
where b.ad_library_id = a.id;

-- Disable creative by asset id (Admin + submit_flag).
create or replace function public.disable_ad_asset(
  p_asset_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_banner uuid;
begin
  select b.id
  into v_banner
  from public.banner_ads b
  where b.ad_library_id = p_asset_id
  order by
    case when b.status in ('active', 'pending_review', 'flagged') then 0 else 1 end,
    b.updated_at desc nulls last
  limit 1;

  if v_banner is null then
    -- No placement: still mark the library asset flagged.
    update public.ad_library a
    set moderation_status = 'flagged',
        flagged_at = coalesce(a.flagged_at, now()),
        moderation_notes = case
          when nullif(trim(coalesce(a.moderation_notes, '')), '') is null
            then coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Ad creative flagged by the community.')
          else a.moderation_notes
        end,
        updated_at = now()
    where a.id = p_asset_id
      and a.deleted_at is null;

    return jsonb_build_object(
      'ok', true,
      'already_disabled', false,
      'user_id', (select user_id from public.ad_library where id = p_asset_id),
      'business_name', coalesce(
        (select nullif(trim(ad_name), '') from public.ad_library where id = p_asset_id),
        'Supporter'
      ),
      'asset_ids', jsonb_build_array(p_asset_id),
      'banner_ids', '[]'::jsonb,
      'zip_codes', '[]'::jsonb,
      'reason', coalesce(nullif(trim(coalesce(p_reason, '')), ''), 'Ad creative flagged by the community.')
    );
  end if;

  return public.disable_ad_asset_from_banner(v_banner, p_reason);
end;
$$;

grant execute on function public.disable_ad_asset(uuid, text) to authenticated;
grant execute on function public.disable_ad_asset(uuid, text) to service_role;

create or replace function public.reactivate_ad_asset(p_asset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_banner uuid;
begin
  select b.id
  into v_banner
  from public.banner_ads b
  where b.ad_library_id = p_asset_id
  order by b.updated_at desc nulls last
  limit 1;

  if v_banner is null then
    update public.ad_library
    set moderation_status = 'approved',
        flagged_at = null,
        updated_at = now()
    where id = p_asset_id
      and deleted_at is null;
    return jsonb_build_object('ok', true, 'asset_ids', jsonb_build_array(p_asset_id));
  end if;

  return public.reactivate_ad_asset_from_banner(v_banner);
end;
$$;

grant execute on function public.reactivate_ad_asset(uuid) to authenticated;
grant execute on function public.reactivate_ad_asset(uuid) to service_role;

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
  v_owner_id uuid;
  v_flagged_by text[];
  v_count numeric;
  v_new_count numeric;
  v_archived boolean := false;
  v_disable jsonb;
  v_asset_id uuid;
  v_banner_id uuid;
  v_moderation text;
  v_report_id uuid;
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
      )
    into v_flagged_by, v_count, v_owner_id, v_contributor
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
      )
    into v_flagged_by, v_count, v_owner_id, v_contributor
    from public.comments c
    where c.id = p_target_id and c.status = 'active';
    if not found then raise exception 'Comment not found or not active'; end if;

  else
    -- Resolve Ad Asset: accept ad_library id or banner_ads id.
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
      coalesce(nullif(trim(a.ad_name), ''), 'Ad')
    into v_flagged_by, v_count, v_owner_id, v_moderation, v_contributor
    from public.ad_library a
    where a.id = v_asset_id
      and a.deleted_at is null;

    if not found then
      raise exception 'Ad asset not found';
    end if;

    if v_moderation = 'flagged' then
      raise exception 'Ad not found or not active';
    end if;

    -- Must be live on at least one zip placement.
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
  v_archived := v_new_count >= 3;

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
        updated_at = now()
    where id = v_report_id;
  elsif p_target_type = 'comment' then
    update public.comments
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        status = case when v_archived then 'archived' else status end,
        updated_at = now()
    where id = v_report_id;
  else
    update public.ad_library
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        updated_at = now()
    where id = v_report_id;

    -- Keep placement counters in sync for Ad Manager UI.
    update public.banner_ads
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        updated_at = now()
    where ad_library_id = v_report_id;

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
