-- Welcome message on new profile + supporter welcome RPC

create or replace function public.notify_welcome_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.user_messages um
    where um.user_id = new.id
      and um.template_key = 'welcome_new_profile'
  ) then
    return new;
  end if;

  perform public.create_user_message(
    new.id,
    'Welcome to Local Kids Calendar!',
    E'Welcome! We''re glad you''re here.\n\nLocal Kids Calendar helps families discover camps, classes, sports, and events nearby. Visit the About page for an overview of the site and tips to get started — whether you''re browsing as a community member, posting as an organizer, or exploring how to support local kids activities.',
    'welcome_new_profile',
    'system',
    'About & Getting Started',
    '/about',
    'profile',
    new.id,
    null,
    '{"channels":["in_app"]}'::jsonb
  );

  return new;
end;
$$;

drop trigger if exists trg_welcome_new_profile on public.profiles;
create trigger trg_welcome_new_profile
  after insert on public.profiles
  for each row
  execute function public.notify_welcome_new_profile();

create or replace function public.notify_became_supporter(p_user_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_id uuid;
  v_is_admin boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ) into v_is_admin;

  if auth.uid() is distinct from v_uid and not v_is_admin then
    raise exception 'Not allowed';
  end if;

  if exists (
    select 1
    from public.user_messages um
    where um.user_id = v_uid
      and um.template_key = 'welcome_supporter'
      and um.deleted_at is null
  ) then
    return null;
  end if;

  v_id := public.create_user_message(
    v_uid,
    'Welcome as a Supporter!',
    E'Thank you for becoming a Supporter of Local Kids Calendar.\n\nYou can manage creatives, zip placements, and billing in Ad Manager. For practical guidance on getting the most from your presence here, read Tips for Supporters.',
    'welcome_supporter',
    'system',
    'Tips For Supporters',
    '/tips-supporters',
    'profile',
    v_uid,
    null,
    '{"channels":["in_app"]}'::jsonb
  );

  return v_id;
end;
$$;

grant execute on function public.notify_became_supporter(uuid) to authenticated;
grant execute on function public.notify_became_supporter(uuid) to service_role;
