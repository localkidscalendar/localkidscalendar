-- Block self-flagging on events and comments

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

  select coalesce(
    nullif(trim(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''))), ''),
    email,
    'Member'
  )
  into v_name
  from public.profiles
  where id = v_uid;

  if p_target_type = 'event' then
    select coalesce(flagged_by, '{}'), coalesce(flag_count, 0), title, created_by_id
    into v_flagged_by, v_count, v_contributor, v_owner_id
    from public.events
    where id = p_target_id and status = 'active';

    if not found then
      raise exception 'Event not found or not active';
    end if;
  else
    select coalesce(flagged_by, '{}'), coalesce(flag_count, 0), coalesce(author_name, 'Comment'), created_by_id
    into v_flagged_by, v_count, v_contributor, v_owner_id
    from public.comments
    where id = p_target_id and status = 'active';

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
