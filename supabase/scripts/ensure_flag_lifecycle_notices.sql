-- Ensure script (safe to re-run)
-- Flag lifecycle notices to content owners + avoid duplicate 3+ hide messages.
-- Also keeps savers notified when activities are auto-archived.

-- ---------------------------------------------------------------------------
-- Helper: inbox notice for owners (in-app only; no email).
-- ---------------------------------------------------------------------------
create or replace function public.notify_owner_flag_lifecycle(
  p_owner_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_event text,
  p_flag_count numeric default null,
  p_reason text default null,
  p_details text default null,
  p_item_label text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_label text;
  v_reason text;
  v_count numeric := coalesce(p_flag_count, 0);
  v_subject text;
  v_body text;
  v_template text;
  v_action_label text;
  v_action_href text;
  v_related_type text;
  v_fix_hint text;
begin
  if p_owner_id is null then
    return null;
  end if;

  if p_target_type = 'event' then
    v_kind := 'activity';
    v_label := coalesce(nullif(trim(p_item_label), ''), 'your activity');
    v_related_type := 'event';
    v_action_label := 'View My Activity Posts';
    v_action_href := '/account?tab=posts';
    v_fix_hint := 'You can edit or deactivate it from My Activity Posts.';
  elsif p_target_type = 'comment' then
    v_kind := 'comment';
    v_label := 'your comment';
    v_related_type := 'comment';
    v_action_label := null;
    v_action_href := null;
    v_fix_hint := 'You can edit or delete your comment on the activity page.';
  elsif p_target_type = 'ad' then
    v_kind := 'ad creative';
    v_label := coalesce(nullif(trim(p_item_label), ''), 'your ad creative');
    v_related_type := 'ad_library';
    v_action_label := 'Open Ad Manager';
    v_action_href := '/ad-manager';
    v_fix_hint := 'If needed, assign a different approved creative in Ad Manager.';
  else
    return null;
  end if;

  v_reason := case lower(coalesce(p_reason, ''))
    when 'inaccurate' then 'Inaccurate'
    when 'inappropriate' then 'Inappropriate'
    when 'spam' then 'Spam'
    when 'other' then 'Other'
    else nullif(initcap(replace(coalesce(p_reason, ''), '_', ' ')), '')
  end;

  if p_event = 'flagged' then
    v_template := p_target_type || '_flagged';
    if v_count >= 3 then
      v_subject := case p_target_type
        when 'event' then 'Your activity was removed'
        when 'comment' then 'Your comment was removed'
        else 'Your ad creative was disabled'
      end;
      v_body := case p_target_type
        when 'event' then format(
          E'Your activity "%s" was flagged by a community member (%s of 3) and has been automatically removed pending review.\n\nReason: %s%s\n\n%s',
          v_label,
          trim(to_char(v_count, '999')),
          coalesce(v_reason, 'Not specified'),
          case when nullif(trim(coalesce(p_details, '')), '') is null then '' else E'\nDetails: ' || trim(p_details) end,
          'You can review it under My Activity Posts.'
        )
        when 'comment' then format(
          E'Your comment was flagged by a community member (%s of 3) and has been automatically removed pending review.\n\nReason: %s%s',
          trim(to_char(v_count, '999')),
          coalesce(v_reason, 'Not specified'),
          case when nullif(trim(coalesce(p_details, '')), '') is null then '' else E'\nDetails: ' || trim(p_details) end
        )
        else format(
          E'Your ad creative "%s" was flagged by a community member (%s of 3) and has been disabled across all zip placements using it.\n\nReason: %s%s\n\n%s',
          v_label,
          trim(to_char(v_count, '999')),
          coalesce(v_reason, 'Not specified'),
          case when nullif(trim(coalesce(p_details, '')), '') is null then '' else E'\nDetails: ' || trim(p_details) end,
          'What Next: Your subscription and billing remain active. Open Ad Manager and assign a different approved creative to each affected zip to restore those placements.'
        )
      end;
      if p_target_type = 'event' then
        v_template := 'activity_removed_flags';
      elsif p_target_type = 'comment' then
        v_template := 'comment_removed_flags';
      else
        v_template := 'ad_removed_flagged';
      end if;
    else
      v_subject := case p_target_type
        when 'event' then 'Your activity was flagged'
        when 'comment' then 'Your comment was flagged'
        else 'Your ad creative was flagged'
      end;
      v_body := case p_target_type
        when 'event' then format(
          E'Your activity "%s" was flagged by a community member (%s of 3).\n\nReason: %s%s\n\n%s Reviewing it now may help prevent additional flags.',
          v_label,
          trim(to_char(v_count, '999')),
          coalesce(v_reason, 'Not specified'),
          case when nullif(trim(coalesce(p_details, '')), '') is null then '' else E'\nDetails: ' || trim(p_details) end,
          v_fix_hint
        )
        when 'comment' then format(
          E'Your comment was flagged by a community member (%s of 3).\n\nReason: %s%s\n\n%s Reviewing it now may help prevent additional flags.',
          trim(to_char(v_count, '999')),
          coalesce(v_reason, 'Not specified'),
          case when nullif(trim(coalesce(p_details, '')), '') is null then '' else E'\nDetails: ' || trim(p_details) end,
          v_fix_hint
        )
        else format(
          E'Your ad creative "%s" was flagged by a community member (%s of 3).\n\nReason: %s%s\n\n%s Reviewing it now may help prevent additional flags.',
          v_label,
          trim(to_char(v_count, '999')),
          coalesce(v_reason, 'Not specified'),
          case when nullif(trim(coalesce(p_details, '')), '') is null then '' else E'\nDetails: ' || trim(p_details) end,
          v_fix_hint
        )
      end;
      v_template := case p_target_type
        when 'event' then 'activity_flagged'
        when 'comment' then 'comment_flagged'
        else 'ad_flagged'
      end;
    end if;

  elsif p_event = 'withdrawn' then
    v_template := case p_target_type
      when 'event' then 'activity_flag_withdrawn'
      when 'comment' then 'comment_flag_withdrawn'
      else 'ad_flag_withdrawn'
    end;
    v_subject := case p_target_type
      when 'event' then 'A flag on your activity was withdrawn'
      when 'comment' then 'A flag on your comment was withdrawn'
      else 'A flag on your ad creative was withdrawn'
    end;
    v_body := case p_target_type
      when 'event' then format(
        E'A community flag on your activity "%s" was withdrawn. Current flags: %s of 3.',
        v_label,
        trim(to_char(v_count, '999'))
      )
      when 'comment' then format(
        E'A community flag on your comment was withdrawn. Current flags: %s of 3.',
        trim(to_char(v_count, '999'))
      )
      else format(
        E'A community flag on your ad creative "%s" was withdrawn. Current flags: %s of 3.',
        v_label,
        trim(to_char(v_count, '999'))
      )
    end;

  elsif p_event = 'cleared' then
    v_template := case p_target_type
      when 'event' then 'activity_flags_cleared'
      when 'comment' then 'comment_flags_cleared'
      else 'ad_flags_cleared'
    end;
    v_subject := case p_target_type
      when 'event' then 'Flags on your activity were cleared'
      when 'comment' then 'Flags on your comment were cleared'
      else 'Flags on your ad creative were cleared'
    end;
    v_body := case p_target_type
      when 'event' then format(
        E'An Admin cleared community flag(s) on your activity "%s". Current flags: %s of 3.',
        v_label,
        trim(to_char(v_count, '999'))
      )
      when 'comment' then format(
        E'An Admin cleared community flag(s) on your comment. Current flags: %s of 3.',
        trim(to_char(v_count, '999'))
      )
      else format(
        E'An Admin cleared community flag(s) on your ad creative "%s". Current flags: %s of 3.',
        v_label,
        trim(to_char(v_count, '999'))
      )
    end;

  elsif p_event = 'reactivated' then
    v_template := case p_target_type
      when 'event' then 'activity_reactivated'
      when 'comment' then 'comment_reactivated'
      else 'ad_reactivated'
    end;
    v_subject := case p_target_type
      when 'event' then 'Your activity was reinstated'
      when 'comment' then 'Your comment was reinstated'
      else 'Your ad creative was reinstated'
    end;
    v_body := case p_target_type
      when 'event' then format(
        E'An Admin reinstated your activity "%s" so it is visible again. Current flags: %s of 3.',
        v_label,
        trim(to_char(v_count, '999'))
      )
      when 'comment' then format(
        E'An Admin reinstated your comment so it is visible again. Current flags: %s of 3.',
        trim(to_char(v_count, '999'))
      )
      else format(
        E'An Admin reinstated your ad creative "%s" so related zip placements can run again. Current flags: %s of 3.',
        v_label,
        trim(to_char(v_count, '999'))
      )
    end;

  else
    return null;
  end if;

  return public.create_user_message(
    p_owner_id,
    v_subject,
    v_body,
    v_template,
    'system',
    v_action_label,
    v_action_href,
    v_related_type,
    p_target_id,
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

revoke all on function public.notify_owner_flag_lifecycle(uuid, text, uuid, text, numeric, text, text, text) from public;
grant execute on function public.notify_owner_flag_lifecycle(uuid, text, uuid, text, numeric, text, text, text) to service_role;

-- Admin can send clear/reactivate notices from the client
create or replace function public.admin_notify_owner_flag_lifecycle(
  p_owner_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_event text,
  p_flag_count numeric default null,
  p_reason text default null,
  p_details text default null,
  p_item_label text default null
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
  return public.notify_owner_flag_lifecycle(
    p_owner_id, p_target_type, p_target_id, p_event,
    p_flag_count, p_reason, p_details, p_item_label
  );
end;
$$;

grant execute on function public.admin_notify_owner_flag_lifecycle(uuid, text, uuid, text, numeric, text, text, text) to authenticated;
grant execute on function public.admin_notify_owner_flag_lifecycle(uuid, text, uuid, text, numeric, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- submit_flag: notify owner on every flag (1/2/3); 3rd includes removal copy
-- ---------------------------------------------------------------------------
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
      ),
      coalesce(nullif(trim(e.title), ''), 'your activity')
    into v_flagged_by, v_count, v_owner_id, v_contributor, v_item_label
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
      left(coalesce(nullif(trim(c.content), ''), 'your comment'), 80)
    into v_flagged_by, v_count, v_owner_id, v_contributor, v_item_label
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
      coalesce(nullif(trim(a.ad_name), ''), 'your ad creative')
    into v_flagged_by, v_count, v_owner_id, v_moderation, v_contributor, v_item_label
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

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'event', v_report_id, 'flagged',
      v_new_count, p_reason, p_details, v_item_label
    );

  elsif p_target_type = 'comment' then
    update public.comments
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        status = case when v_archived then 'archived' else status end,
        updated_at = now()
    where id = v_report_id;

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'comment', v_report_id, 'flagged',
      v_new_count, p_reason, p_details, v_item_label
    );

  else
    update public.ad_library
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        updated_at = now()
    where id = v_report_id;

    update public.banner_ads
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        updated_at = now()
    where ad_library_id = v_report_id;

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'ad', v_report_id, 'flagged',
      v_new_count, p_reason, p_details, v_item_label
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

-- ---------------------------------------------------------------------------
-- withdraw_flag: notify owner when a reporter removes their flag
-- ---------------------------------------------------------------------------
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
  v_owner_id uuid;
  v_item_label text;
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
      a.flag_case_admin_action,
      a.user_id,
      coalesce(nullif(trim(a.ad_name), ''), 'your ad creative')
    into v_flagged_by, v_count, v_status, v_case_action, v_owner_id, v_item_label
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

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'ad', v_asset_id, 'withdrawn',
      v_count, null, null, v_item_label
    );

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
      e.flag_case_admin_action,
      e.created_by_id,
      coalesce(nullif(trim(e.title), ''), 'your activity')
    into v_flagged_by, v_count, v_status, v_case_action, v_owner_id, v_item_label
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

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'event', p_target_id, 'withdrawn',
      v_count, null, null, v_item_label
    );

  else
    select
      coalesce(c.flagged_by, '{}'),
      coalesce(c.flag_count, 0),
      c.status,
      c.flag_case_admin_action,
      c.created_by_id,
      left(coalesce(nullif(trim(c.content), ''), 'your comment'), 80)
    into v_flagged_by, v_count, v_status, v_case_action, v_owner_id, v_item_label
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

    perform public.notify_owner_flag_lifecycle(
      v_owner_id, 'comment', p_target_id, 'withdrawn',
      v_count, null, null, v_item_label
    );
  end if;

  return jsonb_build_object(
    'flag_count', v_count,
    'restored', coalesce(v_restored, false)
  );
end;
$$;

grant execute on function public.withdraw_flag(text, uuid) to authenticated;
grant execute on function public.withdraw_flag(text, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Hide trigger: keep savers notify; skip owner inbox (submit_flag already did)
-- ---------------------------------------------------------------------------
create or replace function public.trg_notify_on_content_hidden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'events' then
    if new.status = 'archived' and old.status is distinct from 'archived' then
      -- Owner inbox is sent from submit_flag (includes reason + N of 3).
      perform public.notify_savers_activity_removed(
        new.id,
        'Removed after community flagging.'
      );
    elsif new.status = 'deleted'
      and old.status is distinct from 'deleted'
      and nullif(trim(coalesce(new.admin_notes, '')), '') is not null
    then
      perform public.notify_savers_activity_removed(new.id, new.admin_notes);
    end if;

  -- comments / banner_ads: owner notices come from submit_flag (and ad email API).
  end if;

  return new;
end;
$$;
