-- Ad Asset–centric flagging: disable the creative and cascade to all zip placements.
-- Soft-delete preserves flagged creatives for Admin review while hiding them from Supporters.

alter table public.ad_library
  add column if not exists deleted_at timestamptz,
  add column if not exists flagged_at timestamptz,
  add column if not exists disable_notified_at timestamptz;

create index if not exists ad_library_deleted_at_idx
  on public.ad_library (user_id)
  where deleted_at is null;

create index if not exists ad_library_flagged_at_idx
  on public.ad_library (flagged_at)
  where flagged_at is not null;

-- Owners only see non-deleted assets; admins still see everything (incl. soft-deleted).
drop policy if exists "Users read own ad library" on public.ad_library;
create policy "Users read own ad library"
  on public.ad_library for select
  to authenticated
  using (
    (
      user_id = auth.uid()
      and deleted_at is null
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Soft-delete / hard-delete helper for Supporters.
create or replace function public.delete_ad_library_asset(p_asset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_asset public.ad_library%rowtype;
  v_has_flags boolean := false;
  v_in_use boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_asset
  from public.ad_library
  where id = p_asset_id
    and user_id = v_uid
    and deleted_at is null;

  if not found then
    raise exception 'Asset not found';
  end if;

  -- Block delete while still used on a publicly live / billing placement.
  select exists (
    select 1
    from public.banner_ads b
    where b.user_id = v_uid
      and b.status in ('active', 'pending_payment', 'pending_review', 'past_due')
      and (
        b.ad_library_id = v_asset.id
        or (b.image_url = v_asset.image_url and b.link_url = v_asset.link_url)
      )
  ) into v_in_use;

  if v_in_use then
    raise exception 'Asset is in use by a live ad campaign';
  end if;

  -- Flag association: asset was flagged, or any banner using it has community/admin flags.
  select
    v_asset.moderation_status = 'flagged'
    or v_asset.flagged_at is not null
    or exists (
      select 1
      from public.banner_ads b
      join public.flag_reports fr
        on fr.target_type = 'ad' and fr.target_id = b.id
      where b.user_id = v_uid
        and (
          b.ad_library_id = v_asset.id
          or (b.image_url = v_asset.image_url and b.link_url = v_asset.link_url)
        )
    )
  into v_has_flags;

  if v_has_flags then
    update public.ad_library
    set deleted_at = now(),
        updated_at = now()
    where id = v_asset.id;
    return jsonb_build_object('mode', 'soft', 'id', v_asset.id);
  end if;

  delete from public.ad_library where id = v_asset.id;
  return jsonb_build_object('mode', 'hard', 'id', v_asset.id);
end;
$$;

grant execute on function public.delete_ad_library_asset(uuid) to authenticated;
grant execute on function public.delete_ad_library_asset(uuid) to service_role;

-- Disable matching Ad Library assets and cascade-flag all related zip placements.
create or replace function public.disable_ad_asset_from_banner(
  p_banner_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_lib uuid;
  v_image text;
  v_link text;
  v_business text;
  v_note text;
  v_asset_ids uuid[] := '{}';
  v_zip_codes text[] := '{}';
  v_banner_ids uuid[] := '{}';
  v_already boolean := false;
begin
  select user_id, ad_library_id, image_url, link_url, business_name
  into v_user, v_lib, v_image, v_link, v_business
  from public.banner_ads
  where id = p_banner_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'banner_not_found');
  end if;

  v_note := nullif(trim(coalesce(p_reason, '')), '');
  if v_note is null then
    v_note := 'This ad creative was disabled and can’t be reused. Choose or create a different approved creative for each affected zip.';
  end if;

  -- Collect matching assets (by id and/or identical creative).
  select coalesce(array_agg(distinct a.id), '{}')
  into v_asset_ids
  from public.ad_library a
  where a.deleted_at is null
    and (
      (v_lib is not null and a.id = v_lib)
      or (
        v_user is not null
        and v_image is not null
        and v_link is not null
        and a.user_id = v_user
        and a.image_url = v_image
        and a.link_url = v_link
      )
    );

  if coalesce(array_length(v_asset_ids, 1), 0) = 0 and v_lib is not null then
    v_asset_ids := array[v_lib];
  end if;

  select exists (
    select 1 from public.ad_library a
    where a.id = any (v_asset_ids)
      and a.moderation_status = 'flagged'
  ) into v_already;

  update public.ad_library a
  set moderation_status = 'flagged',
      flagged_at = coalesce(a.flagged_at, now()),
      moderation_notes = case
        when nullif(trim(coalesce(a.moderation_notes, '')), '') is null then v_note
        else a.moderation_notes
      end,
      updated_at = now()
  where a.id = any (v_asset_ids)
    and a.deleted_at is null;

  -- Cascade: hide every placement still showing (or about to show) this creative.
  with matched as (
    select b.id, b.zip_code
    from public.banner_ads b
    where b.user_id = v_user
      and b.status in ('active', 'pending_review')
      and (
        (v_lib is not null and b.ad_library_id = v_lib)
        or (coalesce(array_length(v_asset_ids, 1), 0) > 0 and b.ad_library_id = any (v_asset_ids))
        or (
          v_image is not null and v_link is not null
          and b.image_url = v_image and b.link_url = v_link
        )
      )
  ),
  updated as (
    update public.banner_ads b
    set status = 'flagged',
        moderation_notes = case
          when nullif(trim(coalesce(b.moderation_notes, '')), '') is null then v_note
          else b.moderation_notes
        end,
        updated_at = now()
    from matched m
    where b.id = m.id
    returning b.id, b.zip_code
  )
  select
    coalesce(array_agg(distinct u.id), '{}'),
    coalesce(array_agg(distinct u.zip_code) filter (where u.zip_code is not null), '{}')
  into v_banner_ids, v_zip_codes
  from updated u;

  -- Ensure the triggering banner is flagged and counted in the result set.
  update public.banner_ads
  set status = 'flagged',
      moderation_notes = case
        when nullif(trim(coalesce(moderation_notes, '')), '') is null then v_note
        else moderation_notes
      end,
      updated_at = now()
  where id = p_banner_id
    and status in ('active', 'pending_review', 'flagged');

  select
    coalesce((
      select array_agg(distinct x.id)
      from (
        select unnest(v_banner_ids) as id
        union
        select p_banner_id
      ) x
    ), array[p_banner_id]),
    coalesce((
      select array_agg(distinct z)
      from (
        select unnest(v_zip_codes) as z
        union
        select b.zip_code
        from public.banner_ads b
        where b.user_id = v_user
          and b.status = 'flagged'
          and b.zip_code is not null
          and (
            (v_lib is not null and b.ad_library_id = v_lib)
            or (coalesce(array_length(v_asset_ids, 1), 0) > 0 and b.ad_library_id = any (v_asset_ids))
            or (
              v_image is not null and v_link is not null
              and b.image_url = v_image and b.link_url = v_link
            )
          )
      ) q
      where z is not null
    ), '{}')
  into v_banner_ids, v_zip_codes;

  return jsonb_build_object(
    'ok', true,
    'already_disabled', v_already,
    'user_id', v_user,
    'business_name', coalesce(nullif(trim(v_business), ''), 'Supporter'),
    'asset_ids', to_jsonb(v_asset_ids),
    'banner_ids', to_jsonb(v_banner_ids),
    'zip_codes', to_jsonb(v_zip_codes),
    'reason', v_note
  );
end;
$$;

grant execute on function public.disable_ad_asset_from_banner(uuid, text) to authenticated;
grant execute on function public.disable_ad_asset_from_banner(uuid, text) to service_role;

-- Admin override: re-approve the asset and restore related flagged placements.
create or replace function public.reactivate_ad_asset_from_banner(p_banner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_lib uuid;
  v_image text;
  v_link text;
  v_asset_ids uuid[] := '{}';
  v_zip_codes text[] := '{}';
  v_banner_ids uuid[] := '{}';
  v_is_admin boolean := false;
begin
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Admin only';
  end if;

  select user_id, ad_library_id, image_url, link_url
  into v_user, v_lib, v_image, v_link
  from public.banner_ads
  where id = p_banner_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'banner_not_found');
  end if;

  select coalesce(array_agg(distinct a.id), '{}')
  into v_asset_ids
  from public.ad_library a
  where (
      (v_lib is not null and a.id = v_lib)
      or (
        v_user is not null
        and v_image is not null
        and v_link is not null
        and a.user_id = v_user
        and a.image_url = v_image
        and a.link_url = v_link
      )
    );

  update public.ad_library a
  set moderation_status = 'approved',
      flagged_at = null,
      deleted_at = null,
      moderation_notes = null,
      disable_notified_at = null,
      updated_at = now()
  where a.id = any (v_asset_ids);

  with matched as (
    select b.id, b.zip_code
    from public.banner_ads b
    where b.user_id = v_user
      and b.status = 'flagged'
      and (
        (v_lib is not null and b.ad_library_id = v_lib)
        or (coalesce(array_length(v_asset_ids, 1), 0) > 0 and b.ad_library_id = any (v_asset_ids))
        or (
          v_image is not null and v_link is not null
          and b.image_url = v_image and b.link_url = v_link
        )
      )
  ),
  updated as (
    update public.banner_ads b
    set status = 'active',
        moderation_status = 'approved',
        moderation_notes = null,
        updated_at = now()
    from matched m
    where b.id = m.id
    returning b.id, b.zip_code
  )
  select
    coalesce(array_agg(distinct u.id), '{}'),
    coalesce(array_agg(distinct u.zip_code) filter (where u.zip_code is not null), '{}')
  into v_banner_ids, v_zip_codes
  from updated u;

  return jsonb_build_object(
    'ok', true,
    'asset_ids', to_jsonb(v_asset_ids),
    'banner_ids', to_jsonb(v_banner_ids),
    'zip_codes', to_jsonb(v_zip_codes)
  );
end;
$$;

grant execute on function public.reactivate_ad_asset_from_banner(uuid) to authenticated;
grant execute on function public.reactivate_ad_asset_from_banner(uuid) to service_role;

-- Mark disable email as sent (idempotent community/admin notify).
create or replace function public.mark_ad_asset_disable_notified(p_asset_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ad_library
  set disable_notified_at = coalesce(disable_notified_at, now()),
      updated_at = now()
  where id = any (p_asset_ids)
    and disable_notified_at is null;
end;
$$;

grant execute on function public.mark_ad_asset_disable_notified(uuid[]) to authenticated;
grant execute on function public.mark_ad_asset_disable_notified(uuid[]) to service_role;

-- Backward-compatible wrapper used by older client paths / submit_flag.
create or replace function public.quarantine_ad_library_for_banner(p_banner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.disable_ad_asset_from_banner(p_banner_id, null);
end;
$$;

-- Patch submit_flag: on 3rd ad flag, disable the Ad Asset and cascade all zips.
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

  if p_reason not in ('inaccurate', 'inappropriate', 'spam', 'other') then
    raise exception 'Invalid reason';
  end if;

  if p_reason = 'other' and nullif(trim(coalesce(p_details, '')), '') is null then
    raise exception 'Details required for other';
  end if;

  if exists (
    select 1 from public.flag_reports
    where reporter_id = v_uid
      and target_type = p_target_type
      and target_id = p_target_id
  ) then
    raise exception 'You already flagged this item';
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
    select
      coalesce(a.flagged_by, '{}'),
      coalesce(a.flag_count, 0),
      a.user_id,
      coalesce(nullif(trim(a.business_name), ''), 'Ad')
    into v_flagged_by, v_count, v_owner_id, v_contributor
    from public.banner_ads a
    where a.id = p_target_id and a.status = 'active';
    if not found then raise exception 'Ad not found or not active'; end if;
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

  insert into public.flag_reports (
    target_type, target_id, reason, details, reporter_id, reporter_name, target_contributor_name
  ) values (
    p_target_type,
    p_target_id,
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
    where id = p_target_id;
  elsif p_target_type = 'comment' then
    update public.comments
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        status = case when v_archived then 'archived' else status end,
        updated_at = now()
    where id = p_target_id;
  else
    update public.banner_ads
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        updated_at = now()
    where id = p_target_id;

    if v_archived then
      v_disable := public.disable_ad_asset_from_banner(
        p_target_id,
        'Ad creative flagged by 3+ community members and disabled across all zip placements.'
      );
      return jsonb_build_object(
        'flag_count', v_new_count,
        'archived', true,
        'asset_disabled', true,
        'zip_codes', coalesce(v_disable->'zip_codes', '[]'::jsonb),
        'user_id', v_disable->'user_id',
        'business_name', v_disable->'business_name',
        'asset_ids', coalesce(v_disable->'asset_ids', '[]'::jsonb),
        'needs_notify', not coalesce((v_disable->>'already_disabled')::boolean, false)
      );
    end if;
  end if;

  return jsonb_build_object('flag_count', v_new_count, 'archived', v_archived);
end;
$$;
