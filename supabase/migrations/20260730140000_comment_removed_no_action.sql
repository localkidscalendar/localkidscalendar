-- Comment auto-remove notices: no action button (flagged comments have no user destination).

create or replace function public.trg_notify_on_content_hidden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_body text;
begin
  if tg_table_name = 'events' then
    if new.status = 'archived' and old.status is distinct from 'archived' then
      v_title := coalesce(nullif(trim(new.title), ''), 'your activity');
      v_body := format(
        'Your activity "%s" was automatically removed after being flagged by 3+ community members. You can review it under My Activity Posts.',
        v_title
      );
      if new.created_by_id is not null then
        perform public.create_user_message(
          new.created_by_id,
          'Your activity was removed',
          v_body,
          'activity_removed_flags',
          'system',
          'View My Activity Posts',
          '/account?tab=posts',
          'event',
          new.id,
          null,
          jsonb_build_object('activity_title', v_title, 'channels', jsonb_build_array('in_app'))
        );
      end if;
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

  elsif tg_table_name = 'comments' then
    if new.status = 'archived' and old.status is distinct from 'archived' then
      if new.created_by_id is not null then
        perform public.create_user_message(
          new.created_by_id,
          'Your comment was removed',
          'Your comment was automatically removed after being flagged by 3+ community members.',
          'comment_removed_flags',
          'system',
          null,
          null,
          'comment',
          new.id,
          null,
          jsonb_build_object('channels', jsonb_build_array('in_app'))
        );
      end if;
    end if;

  elsif tg_table_name = 'banner_ads' then
    if new.status = 'flagged'
      and old.status is distinct from 'flagged'
      and coalesce(new.flag_count, 0) >= 3
    then
      if new.user_id is not null then
        perform public.create_user_message(
          new.user_id,
          'Your ad creative was disabled',
          format(
            E'Your Supporter ad creative was disabled after community flagging across zip %s.\n\nReason: Ad creative flagged by 3+ community members and disabled across all zip placements.\n\nWhat Next: Your subscription and billing remain active. Open Ad Manager and assign a different approved creative to each affected zip to restore those placements. Each zip goes live again as soon as you assign a compliant Ad Asset.',
            coalesce(new.zip_code, 'your area')
          ),
          'ad_removed_flagged',
          'system',
          'Open Ad Manager',
          '/ad-manager',
          'ad',
          new.id,
          null,
          jsonb_build_object('zip_code', new.zip_code, 'channels', jsonb_build_array('in_app', 'email'))
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- Clear dead / pointless action buttons on existing comment-removed notices
update public.user_messages
set
  action_label = null,
  action_href = null,
  updated_at = now()
where template_key = 'comment_removed_flags'
  and (
    action_label is not null
    or action_href is not null
  );
