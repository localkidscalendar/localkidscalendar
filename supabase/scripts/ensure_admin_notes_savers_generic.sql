-- Saver notices: always generic (never Admin comments for the poster).
-- Clear-flag notices: optional Admin note via p_details.

create or replace function public.notify_savers_activity_removed(
  p_event_id uuid,
  p_reason text default null
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_count int := 0;
  r record;
  v_body text;
begin
  select title into v_title from public.events where id = p_event_id;
  if v_title is null then
    return 0;
  end if;

  -- p_reason intentionally ignored for user-facing copy (poster-only notes).
  v_body := format(
    'An activity you saved ("%s") is no longer available on Local Kids Calendar.',
    v_title
  );

  for r in
    select distinct s.user_id
    from public.saved_events s
    where s.event_id = p_event_id
      and s.user_id is not null
  loop
    perform public.create_user_message(
      r.user_id,
      'A saved activity was removed',
      v_body,
      'saved_activity_removed',
      'system',
      'View saved activities',
      '/account?tab=saved',
      'event',
      p_event_id,
      null,
      jsonb_build_object('activity_title', v_title)
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Append optional Admin note on clear / partial_clear for content owners.
create or replace function public.notify_owner_flag_lifecycle(
  p_owner_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_event text,
  p_flag_count numeric default null,
  p_reason text default null,
  p_details text default null,
  p_item_label text default null,
  p_auto_hidden boolean default null
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
  v_show_removed boolean;
  v_count_label text;
  v_admin_note text := nullif(trim(coalesce(p_details, '')), '');
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
    v_show_removed := coalesce(p_auto_hidden, v_count >= 3);
    v_count_label := case
      when v_show_removed or v_count < 3 then trim(to_char(v_count, '999')) || ' of 3'
      else trim(to_char(v_count, '999')) || ' community flags'
    end;
    if v_show_removed then
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
          case when v_admin_note is null then '' else E'\nDetails: ' || v_admin_note end,
          'You can review it under My Activity Posts.'
        )
        when 'comment' then format(
          E'Your comment was flagged by a community member (%s of 3) and has been automatically removed pending review.\n\nReason: %s%s',
          trim(to_char(v_count, '999')),
          coalesce(v_reason, 'Not specified'),
          case when v_admin_note is null then '' else E'\nDetails: ' || v_admin_note end
        )
        else format(
          E'Your ad creative "%s" was flagged by a community member (%s of 3) and has been disabled across all zip placements using it.\n\nReason: %s%s\n\n%s',
          v_label,
          trim(to_char(v_count, '999')),
          coalesce(v_reason, 'Not specified'),
          case when v_admin_note is null then '' else E'\nDetails: ' || v_admin_note end,
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
          E'Your activity "%s" was flagged by a community member (%s).\n\nReason: %s%s\n\n%s Reviewing it now may help prevent additional flags.',
          v_label,
          v_count_label,
          coalesce(v_reason, 'Not specified'),
          case when v_admin_note is null then '' else E'\nDetails: ' || v_admin_note end,
          v_fix_hint
        )
        when 'comment' then format(
          E'Your comment was flagged by a community member (%s).\n\nReason: %s%s\n\n%s Reviewing it now may help prevent additional flags.',
          v_count_label,
          coalesce(v_reason, 'Not specified'),
          case when v_admin_note is null then '' else E'\nDetails: ' || v_admin_note end,
          v_fix_hint
        )
        else format(
          E'Your ad creative "%s" was flagged by a community member (%s).\n\nReason: %s%s\n\n%s Reviewing it now may help prevent additional flags.',
          v_label,
          v_count_label,
          coalesce(v_reason, 'Not specified'),
          case when v_admin_note is null then '' else E'\nDetails: ' || v_admin_note end,
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
      when 'event' then 'Your activity was reinstated'
      when 'comment' then 'Your comment was reinstated'
      else 'Your ad creative was reinstated'
    end;
    v_body := case p_target_type
      when 'event' then format(
        E'An Admin overrode the 3+ flag rule and reactivated your activity "%s", but it could be subject to deactivation again with more flags.',
        v_label
      )
      when 'comment' then
        E'An Admin overrode the 3+ flag rule and reactivated your comment, but it could be subject to deactivation again with more flags.'
      else format(
        E'An Admin overrode the 3+ flag rule and reactivated your ad creative "%s", but it could be subject to deactivation again with more flags.',
        v_label
      )
    end;

  elsif p_event = 'partial_cleared' then
    v_template := case p_target_type
      when 'event' then 'activity_flag_partial_cleared'
      when 'comment' then 'comment_flag_partial_cleared'
      else 'ad_flag_partial_cleared'
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

  elsif p_event in ('reactivated', 'overridden') then
    v_template := case p_target_type
      when 'event' then 'activity_flag_overridden'
      when 'comment' then 'comment_flag_overridden'
      else 'ad_flag_overridden'
    end;
    v_subject := case p_target_type
      when 'event' then 'Your activity was reinstated'
      when 'comment' then 'Your comment was reinstated'
      else 'Your ad creative was reinstated'
    end;
    v_body := case p_target_type
      when 'event' then format(
        E'An Admin overrode the 3+ flag rule and reactivated your activity "%s".',
        v_label
      )
      when 'comment' then
        E'An Admin overrode the 3+ flag rule and reactivated your comment.'
      else format(
        E'An Admin overrode the 3+ flag rule and reactivated your ad creative "%s".',
        v_label
      )
    end;

  else
    return null;
  end if;

  if p_event in ('cleared', 'partial_cleared') and v_admin_note is not null then
    v_body := v_body || E'\n\nNote from Admin:\n' || v_admin_note;
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

  if p_event in ('cleared', 'partial_cleared') and v_details is not null then
    v_body := v_body || E'\n\nNote from Admin:\n' || v_details;
  end if;

  return public.create_user_message(
    p_owner_id,
    v_subject,
    v_body,
    v_template,
    'system',
    'Open My Messages',
    '/account?tab=messages',
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
