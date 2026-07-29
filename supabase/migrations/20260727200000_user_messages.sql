-- Lightweight one-way user messaging (inbox + admin mass send)

create table if not exists public.mass_messages (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  body text not null,
  audience_role text not null default 'all'
    check (audience_role in ('all', 'community_member', 'organizer', 'advertiser')),
  audience_zips text[] not null default '{}',
  recipient_count numeric not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mass_messages_created_at_idx
  on public.mass_messages (created_at desc);

create table if not exists public.user_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  template_key text,
  source text not null default 'system'
    check (source in ('system', 'admin')),
  subject text not null,
  body text not null,
  action_label text,
  action_href text,
  related_type text,
  related_id uuid,
  mass_message_id uuid references public.mass_messages (id) on delete set null,
  read_at timestamptz,
  deleted_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_messages_user_created_idx
  on public.user_messages (user_id, created_at desc)
  where deleted_at is null;

create index if not exists user_messages_user_unread_idx
  on public.user_messages (user_id)
  where deleted_at is null and read_at is null;

alter table public.mass_messages enable row level security;
alter table public.user_messages enable row level security;

drop policy if exists "Admins manage mass messages" on public.mass_messages;
create policy "Admins manage mass messages"
  on public.mass_messages for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Users read own messages" on public.user_messages;
create policy "Users read own messages"
  on public.user_messages for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Users update own messages" on public.user_messages;
create policy "Users update own messages"
  on public.user_messages for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Admins insert user messages" on public.user_messages;
create policy "Admins insert user messages"
  on public.user_messages for insert
  to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

grant select, insert, update on public.mass_messages to authenticated;
grant select, insert, update on public.user_messages to authenticated;

-- Helper: create a single inbox message (admin or security definer callers)
create or replace function public.create_user_message(
  p_user_id uuid,
  p_subject text,
  p_body text,
  p_template_key text default null,
  p_source text default 'system',
  p_action_label text default null,
  p_action_href text default null,
  p_related_type text default null,
  p_related_id uuid default null,
  p_mass_message_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_source text := coalesce(nullif(trim(p_source), ''), 'system');
begin
  if p_user_id is null then
    raise exception 'user_id required';
  end if;
  if nullif(trim(p_subject), '') is null then
    raise exception 'subject required';
  end if;
  if nullif(trim(p_body), '') is null then
    raise exception 'body required';
  end if;
  if v_source not in ('system', 'admin') then
    v_source := 'system';
  end if;

  insert into public.user_messages (
    user_id, template_key, source, subject, body,
    action_label, action_href, related_type, related_id,
    mass_message_id, metadata
  ) values (
    p_user_id,
    nullif(trim(p_template_key), ''),
    v_source,
    trim(p_subject),
    trim(p_body),
    nullif(trim(p_action_label), ''),
    nullif(trim(p_action_href), ''),
    nullif(trim(p_related_type), ''),
    p_related_id,
    p_mass_message_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_user_message(
  uuid, text, text, text, text, text, text, text, uuid, uuid, jsonb
) to service_role;

-- Admin-facing wrapper (authenticated admins only)
create or replace function public.admin_create_user_message(
  p_user_id uuid,
  p_subject text,
  p_body text,
  p_template_key text default null,
  p_source text default 'system',
  p_action_label text default null,
  p_action_href text default null,
  p_related_type text default null,
  p_related_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
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

  return public.create_user_message(
    p_user_id, p_subject, p_body, p_template_key, p_source,
    p_action_label, p_action_href, p_related_type, p_related_id,
    null, p_metadata
  );
end;
$$;

grant execute on function public.admin_create_user_message(
  uuid, text, text, text, text, text, text, text, uuid, jsonb
) to authenticated;
grant execute on function public.admin_create_user_message(
  uuid, text, text, text, text, text, text, text, uuid, jsonb
) to service_role;

-- Admin mass send
create or replace function public.send_mass_message(
  p_subject text,
  p_body text,
  p_audience_role text default 'all',
  p_audience_zips text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_mass_id uuid;
  v_count int := 0;
  v_role text := coalesce(nullif(trim(p_audience_role), ''), 'all');
  v_zips text[] := coalesce(p_audience_zips, '{}');
  r record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'admin'
  ) into v_is_admin;

  if not v_is_admin then
    raise exception 'Admin only';
  end if;

  if nullif(trim(p_subject), '') is null or nullif(trim(p_body), '') is null then
    raise exception 'Subject and message are required';
  end if;

  if v_role not in ('all', 'community_member', 'organizer', 'advertiser') then
    raise exception 'Invalid audience role';
  end if;

  insert into public.mass_messages (
    subject, body, audience_role, audience_zips, created_by
  ) values (
    trim(p_subject), trim(p_body), v_role, v_zips, v_uid
  )
  returning id into v_mass_id;

  for r in
    select p.id
    from public.profiles p
    where p.role is distinct from 'disabled'
      and (
        v_role = 'all'
        or (v_role = 'community_member' and p.role = 'community_member')
        or (v_role = 'organizer' and p.role = 'organizer')
        or (
          v_role = 'advertiser'
          and exists (
            select 1 from public.banner_ads b where b.user_id = p.id
          )
        )
      )
      and (
        coalesce(array_length(v_zips, 1), 0) = 0
        or p.zip_code = any (v_zips)
        or (
          v_role = 'advertiser'
          and exists (
            select 1 from public.banner_ads b
            where b.user_id = p.id and b.zip_code = any (v_zips)
          )
        )
      )
  loop
    perform public.create_user_message(
      r.id,
      trim(p_subject),
      trim(p_body),
      'mass_message',
      'admin',
      'Go to My Account',
      '/account?tab=messages',
      null,
      null,
      v_mass_id,
      jsonb_build_object('audience_role', v_role, 'audience_zips', to_jsonb(v_zips))
    );
    v_count := v_count + 1;
  end loop;

  update public.mass_messages
  set recipient_count = v_count
  where id = v_mass_id;

  return jsonb_build_object(
    'ok', true,
    'mass_message_id', v_mass_id,
    'recipient_count', v_count
  );
end;
$$;

grant execute on function public.send_mass_message(text, text, text, text[]) to authenticated;
grant execute on function public.send_mass_message(text, text, text, text[]) to service_role;

-- Notify activity savers when an activity is removed/archived
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

  v_body := format(
    'An activity you saved ("%s") is no longer available on Local Kids Calendar.%s',
    v_title,
    case
      when nullif(trim(coalesce(p_reason, '')), '') is null then ''
      else E'\n\nNote: ' || trim(p_reason)
    end
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

-- Internal helper; call via admin_notify_savers_activity_removed or other security definer functions.
revoke all on function public.notify_savers_activity_removed(uuid, text) from public;
revoke all on function public.notify_savers_activity_removed(uuid, text) from authenticated;
grant execute on function public.notify_savers_activity_removed(uuid, text) to service_role;

create or replace function public.admin_notify_savers_activity_removed(
  p_event_id uuid,
  p_reason text default null
)
returns int
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
  return public.notify_savers_activity_removed(p_event_id, p_reason);
end;
$$;

grant execute on function public.admin_notify_savers_activity_removed(uuid, text) to authenticated;
grant execute on function public.admin_notify_savers_activity_removed(uuid, text) to service_role;

-- Community auto-hide → inbox notices for owners (+ savers for activities)
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
        'Your activity "%s" was automatically removed after being flagged by 3+ community members. You can review it under My Posts / My Flagged Content.',
        v_title
      );
      if new.created_by_id is not null then
        perform public.create_user_message(
          new.created_by_id,
          'Your activity was removed',
          v_body,
          'activity_removed_flags',
          'system',
          'View My Posts',
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
          'View My Flagged Content',
          '/account?tab=flagged',
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
            'Your Supporter ad creative for zip %s was disabled after community flagging. Billing stays active — assign a different approved creative in Ad Manager to restore each affected zip.',
            coalesce(new.zip_code, '')
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

drop trigger if exists trg_events_notify_hidden on public.events;
create trigger trg_events_notify_hidden
  after update of status on public.events
  for each row
  execute function public.trg_notify_on_content_hidden();

drop trigger if exists trg_comments_notify_hidden on public.comments;
create trigger trg_comments_notify_hidden
  after update of status on public.comments
  for each row
  execute function public.trg_notify_on_content_hidden();

drop trigger if exists trg_banner_ads_notify_hidden on public.banner_ads;
create trigger trg_banner_ads_notify_hidden
  after update of status on public.banner_ads
  for each row
  execute function public.trg_notify_on_content_hidden();
