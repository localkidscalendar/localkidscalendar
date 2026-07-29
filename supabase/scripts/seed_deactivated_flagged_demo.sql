-- DEMO DATA: populate Admin → Flags → Deactivated Content (Flagged 3+ times)
-- Run in the Supabase SQL Editor. Safe to re-run (cleans prior demo rows first).
-- Uses existing activity / comment / ad rows when available.

-- Remove previous demo flag reports
delete from public.flag_reports
where details like '[DEMO 3+]%';

do $$
declare
  v_event_id uuid;
  v_event_owner uuid;
  v_event_title text;
  v_comment_id uuid;
  v_comment_owner uuid;
  v_comment_event uuid;
  v_ad_id uuid;
  v_ad_owner uuid;
  v_ad_name text;
  r1 uuid;
  r2 uuid;
  r3 uuid;
  r1_name text;
  r2_name text;
  r3_name text;
begin
  -- Need at least 3 profiles to act as distinct flaggers
  select p.id into r1 from public.profiles p order by p.created_at nulls last, p.id limit 1;
  select p.id into r2 from public.profiles p where p.id <> r1 order by p.created_at nulls last, p.id limit 1;
  select p.id into r3 from public.profiles p where p.id not in (r1, r2) order by p.created_at nulls last, p.id limit 1;

  if r1 is null or r2 is null or r3 is null then
    raise exception 'Need at least 3 user profiles to seed demo 3+ flags.';
  end if;

  select coalesce(nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''), p.email, 'Demo Reporter 1')
    into r1_name from public.profiles p where p.id = r1;
  select coalesce(nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''), p.email, 'Demo Reporter 2')
    into r2_name from public.profiles p where p.id = r2;
  select coalesce(nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''), p.email, 'Demo Reporter 3')
    into r3_name from public.profiles p where p.id = r3;

  ------------------------------------------------------------------
  -- Activity (event)
  ------------------------------------------------------------------
  select e.id, e.created_by_id, e.title
    into v_event_id, v_event_owner, v_event_title
  from public.events e
  where e.created_by_id is distinct from r1
    and e.created_by_id is distinct from r2
    and e.created_by_id is distinct from r3
  order by e.created_at desc nulls last
  limit 1;

  if v_event_id is null then
    select e.id, e.created_by_id, e.title
      into v_event_id, v_event_owner, v_event_title
    from public.events e
    order by e.created_at desc nulls last
    limit 1;
  end if;

  if v_event_id is not null then
    -- Prefer reporters who are not the activity owner
    if v_event_owner in (r1, r2, r3) then
      select p.id into r1 from public.profiles p where p.id is distinct from v_event_owner order by p.created_at nulls last, p.id limit 1;
      select p.id into r2 from public.profiles p where p.id is distinct from v_event_owner and p.id <> r1 order by p.created_at nulls last, p.id limit 1;
      select p.id into r3 from public.profiles p where p.id is distinct from v_event_owner and p.id not in (r1, r2) order by p.created_at nulls last, p.id limit 1;
      select coalesce(nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''), p.email, 'Demo Reporter 1')
        into r1_name from public.profiles p where p.id = r1;
      select coalesce(nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''), p.email, 'Demo Reporter 2')
        into r2_name from public.profiles p where p.id = r2;
      select coalesce(nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), ''), p.email, 'Demo Reporter 3')
        into r3_name from public.profiles p where p.id = r3;
    end if;

    delete from public.flag_reports
    where target_type = 'event' and target_id = v_event_id;

    update public.events
    set
      status = 'archived',
      flag_count = 3,
      flagged_by = array[r1::text, r2::text, r3::text],
      updated_at = now()
    where id = v_event_id;

    insert into public.flag_reports (
      target_type, target_id, reason, details, reporter_id, reporter_name, target_contributor_name, reviewed, admin_action
    ) values
      ('event', v_event_id, 'inappropriate', '[DEMO 3+] Sample flag 1 for deactivated activity review', r1, r1_name, coalesce(v_event_title, 'Activity'), false, null),
      ('event', v_event_id, 'spam', '[DEMO 3+] Sample flag 2 for deactivated activity review', r2, r2_name, coalesce(v_event_title, 'Activity'), false, null),
      ('event', v_event_id, 'inaccurate', '[DEMO 3+] Sample flag 3 for deactivated activity review', r3, r3_name, coalesce(v_event_title, 'Activity'), false, null);
  end if;

  ------------------------------------------------------------------
  -- Comment (create one on the demo event if none exist)
  ------------------------------------------------------------------
  select c.id, c.created_by_id, c.event_id
    into v_comment_id, v_comment_owner, v_comment_event
  from public.comments c
  where c.created_by_id is distinct from r1
    and c.created_by_id is distinct from r2
    and c.created_by_id is distinct from r3
  order by c.created_at desc nulls last
  limit 1;

  if v_comment_id is null and v_event_id is not null then
    insert into public.comments (event_id, content, author_name, created_by_id, status, flag_count, flagged_by)
    values (
      v_event_id,
      'DEMO comment for Admin Flags — Deactivated Content (Flagged 3+ times) preview.',
      'Demo Commenter',
      coalesce(v_event_owner, r1),
      'active',
      0,
      '{}'::text[]
    )
    returning id, created_by_id, event_id into v_comment_id, v_comment_owner, v_comment_event;
  end if;

  if v_comment_id is not null then
    delete from public.flag_reports
    where target_type = 'comment' and target_id = v_comment_id;

    update public.comments
    set
      status = 'archived',
      content = case
        when content like 'DEMO comment for Admin Flags%' then content
        else coalesce(content, '') || E'\n\n[DEMO 3+] Sample archived comment for admin review.'
      end,
      flag_count = 3,
      flagged_by = array[r1::text, r2::text, r3::text],
      updated_at = now()
    where id = v_comment_id;

    insert into public.flag_reports (
      target_type, target_id, reason, details, reporter_id, reporter_name, target_contributor_name, reviewed, admin_action
    ) values
      ('comment', v_comment_id, 'inappropriate', '[DEMO 3+] Sample flag 1 for deactivated comment review', r1, r1_name, 'Comment', false, null),
      ('comment', v_comment_id, 'spam', '[DEMO 3+] Sample flag 2 for deactivated comment review', r2, r2_name, 'Comment', false, null),
      ('comment', v_comment_id, 'other', '[DEMO 3+] Sample flag 3 for deactivated comment review', r3, r3_name, 'Comment', false, null);
  end if;

  ------------------------------------------------------------------
  -- Ad (if any banner_ads exist)
  ------------------------------------------------------------------
  select a.id, a.user_id, a.business_name
    into v_ad_id, v_ad_owner, v_ad_name
  from public.banner_ads a
  where a.user_id is distinct from r1
    and a.user_id is distinct from r2
    and a.user_id is distinct from r3
  order by a.created_at desc nulls last
  limit 1;

  if v_ad_id is null then
    select a.id, a.user_id, a.business_name
      into v_ad_id, v_ad_owner, v_ad_name
    from public.banner_ads a
    order by a.created_at desc nulls last
    limit 1;
  end if;

  if v_ad_id is not null then
    delete from public.flag_reports
    where target_type = 'ad' and target_id = v_ad_id;

    update public.banner_ads
    set
      status = 'flagged',
      flag_count = 3,
      flagged_by = array[r1::text, r2::text, r3::text],
      updated_at = now()
    where id = v_ad_id;

    insert into public.flag_reports (
      target_type, target_id, reason, details, reporter_id, reporter_name, target_contributor_name, reviewed, admin_action
    ) values
      ('ad', v_ad_id, 'inappropriate', '[DEMO 3+] Sample flag 1 for deactivated ad review', r1, r1_name, coalesce(v_ad_name, 'Ad'), false, null),
      ('ad', v_ad_id, 'spam', '[DEMO 3+] Sample flag 2 for deactivated ad review', r2, r2_name, coalesce(v_ad_name, 'Ad'), false, null),
      ('ad', v_ad_id, 'inaccurate', '[DEMO 3+] Sample flag 3 for deactivated ad review', r3, r3_name, coalesce(v_ad_name, 'Ad'), false, null);
  end if;

  raise notice 'Demo 3+ flags seeded. event=%, comment=%, ad=%', v_event_id, v_comment_id, v_ad_id;
end $$;
