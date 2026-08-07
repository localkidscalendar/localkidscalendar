-- User-flag inbox notices: no action button (user is already on My Messages).

-- After suspension lift: digests stay Off; tell the user clearly in reinstatement messages.

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
  v_reinstated_note text := E'\n\nIf your account was suspended, it has been reinstated for normal use. Weekly digests stay Off — turn them back on anytime in Account → Notifications if you want them.';
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
      case when v_count < 3 then v_reinstated_note else '' end
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
      case when v_count < 3 then v_reinstated_note else '' end
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
