-- Better display names for flag reports + backfill existing rows

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

  if p_target_type not in ('event', 'comment') then
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

  -- Prefer organizer name, then profile name, then email
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

    if not found then
      raise exception 'Event not found or not active';
    end if;
  else
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

    if not found then
      raise exception 'Comment not found or not active';
    end if;
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
    target_type,
    target_id,
    reason,
    details,
    reporter_id,
    reporter_name,
    target_contributor_name
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
    set
      flag_count = v_new_count,
      flagged_by = v_flagged_by,
      status = case when v_archived then 'archived' else status end,
      updated_at = now()
    where id = p_target_id;
  else
    update public.comments
    set
      flag_count = v_new_count,
      flagged_by = v_flagged_by,
      status = case when v_archived then 'archived' else status end,
      updated_at = now()
    where id = p_target_id;
  end if;

  return jsonb_build_object(
    'flag_count', v_new_count,
    'archived', v_archived
  );
end;
$$;

-- Backfill names on existing reports
update public.flag_reports fr
set reporter_name = coalesce(
  (select nullif(trim(o.org_name), '') from public.organizers o where o.user_id = fr.reporter_id limit 1),
  (select nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), '')
     from public.profiles p where p.id = fr.reporter_id),
  fr.reporter_name
);

update public.flag_reports fr
set target_contributor_name = coalesce(
  (select nullif(trim(e.org_name), '') from public.events e where e.id = fr.target_id),
  (select nullif(trim(o.org_name), '')
     from public.events e
     join public.organizers o on o.user_id = e.created_by_id
     where e.id = fr.target_id
     limit 1),
  (select nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), '')
     from public.events e
     join public.profiles p on p.id = e.created_by_id
     where e.id = fr.target_id),
  fr.target_contributor_name
)
where fr.target_type = 'event';
