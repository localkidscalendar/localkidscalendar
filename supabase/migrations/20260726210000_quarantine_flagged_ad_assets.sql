-- Quarantine ad library creatives when the linked banner ad is flagged,
-- so they cannot be reused after the ad is reactivated with a replacement.

-- Expand moderation_status to include 'flagged'
do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'ad_library'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%moderation_status%';

  if cname is not null then
    execute format('alter table public.ad_library drop constraint %I', cname);
  end if;
end $$;

alter table public.ad_library
  add constraint ad_library_moderation_status_check
  check (moderation_status in (
    'pending', 'approved', 'declined', 'manual_review', 'manual_review_declined', 'flagged'
  ));

create or replace function public.quarantine_ad_library_for_banner(p_banner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_lib uuid;
  v_image text;
  v_link text;
  v_note text := 'Unavailable: this creative was used on a flagged or rejected ad.';
begin
  select user_id, ad_library_id, image_url, link_url
  into v_user, v_lib, v_image, v_link
  from public.banner_ads
  where id = p_banner_id;

  if not found then
    return;
  end if;

  if v_lib is not null then
    update public.ad_library
    set moderation_status = 'flagged',
        moderation_notes = case
          when nullif(trim(coalesce(moderation_notes, '')), '') is null then v_note
          else moderation_notes
        end,
        updated_at = now()
    where id = v_lib
      and moderation_status = 'approved';
  end if;

  if v_user is not null and v_image is not null and v_link is not null then
    update public.ad_library
    set moderation_status = 'flagged',
        moderation_notes = case
          when nullif(trim(coalesce(moderation_notes, '')), '') is null then v_note
          else moderation_notes
        end,
        updated_at = now()
    where user_id = v_user
      and image_url = v_image
      and link_url = v_link
      and moderation_status = 'approved';
  end if;
end;
$$;

grant execute on function public.quarantine_ad_library_for_banner(uuid) to authenticated;
grant execute on function public.quarantine_ad_library_for_banner(uuid) to service_role;

-- Patch submit_flag: when an ad hits 3 flags, quarantine its library creative
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
        status = case when v_archived then 'flagged' else status end,
        updated_at = now()
    where id = p_target_id;

    if v_archived then
      perform public.quarantine_ad_library_for_banner(p_target_id);
    end if;
  end if;

  return jsonb_build_object('flag_count', v_new_count, 'archived', v_archived);
end;
$$;
