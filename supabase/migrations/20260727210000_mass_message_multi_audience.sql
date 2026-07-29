-- Mass messages: multi-audience support (roles array)

alter table public.mass_messages
  add column if not exists audience_roles text[] not null default '{all}';

update public.mass_messages
set audience_roles = array[audience_role]
where audience_role is not null
  and (audience_roles = '{all}' or audience_roles is null or audience_roles = '{}')
  and audience_role is distinct from 'all';

update public.mass_messages
set audience_roles = '{all}'
where audience_role = 'all'
  and (audience_roles is null or audience_roles = '{}');

create or replace function public.send_mass_message(
  p_subject text,
  p_body text,
  p_audience_roles text[] default array['all']::text[],
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
  v_roles text[] := coalesce(p_audience_roles, array['all']::text[]);
  v_zips text[] := coalesce(p_audience_zips, '{}');
  v_role_label text;
  v_want_all boolean := false;
  v_want_cm boolean := false;
  v_want_org boolean := false;
  v_want_adv boolean := false;
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

  -- Normalize roles: All exclusive; selecting all three specifics = All
  if 'all' = any (v_roles)
     or coalesce(array_length(v_roles, 1), 0) = 0
     or (
       'community_member' = any (v_roles)
       and 'organizer' = any (v_roles)
       and 'advertiser' = any (v_roles)
     )
  then
    v_roles := array['all']::text[];
    v_want_all := true;
  else
    v_want_cm := 'community_member' = any (v_roles);
    v_want_org := 'organizer' = any (v_roles);
    v_want_adv := 'advertiser' = any (v_roles);
    if not (v_want_cm or v_want_org or v_want_adv) then
      v_roles := array['all']::text[];
      v_want_all := true;
    end if;
  end if;

  v_role_label := case
    when v_want_all then 'all'
    when v_want_cm and not v_want_org and not v_want_adv then 'community_member'
    when v_want_org and not v_want_cm and not v_want_adv then 'organizer'
    when v_want_adv and not v_want_cm and not v_want_org then 'advertiser'
    else 'all'
  end;

  insert into public.mass_messages (
    subject, body, audience_role, audience_roles, audience_zips, created_by
  ) values (
    trim(p_subject), trim(p_body), v_role_label, v_roles, v_zips, v_uid
  )
  returning id into v_mass_id;

  for r in
    select p.id
    from public.profiles p
    where p.role is distinct from 'disabled'
      and (
        v_want_all
        or (v_want_cm and p.role = 'community_member')
        or (v_want_org and p.role = 'organizer')
        or (
          v_want_adv
          and exists (select 1 from public.banner_ads b where b.user_id = p.id)
        )
      )
      and (
        coalesce(array_length(v_zips, 1), 0) = 0
        or p.zip_code = any (v_zips)
        or (
          v_want_adv
          and exists (
            select 1 from public.banner_ads b
            where b.user_id = p.id and b.zip_code = any (v_zips)
          )
        )
        or (
          v_want_all
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
      jsonb_build_object('audience_roles', to_jsonb(v_roles), 'audience_zips', to_jsonb(v_zips))
    );
    v_count := v_count + 1;
  end loop;

  update public.mass_messages
  set recipient_count = v_count
  where id = v_mass_id;

  return jsonb_build_object(
    'ok', true,
    'mass_message_id', v_mass_id,
    'recipient_count', v_count,
    'audience_roles', to_jsonb(v_roles)
  );
end;
$$;

-- Prefer the multi-role signature; drop old single-role overload if present.
drop function if exists public.send_mass_message(text, text, text, text[]);

grant execute on function public.send_mass_message(text, text, text[], text[]) to authenticated;
grant execute on function public.send_mass_message(text, text, text[], text[]) to service_role;
