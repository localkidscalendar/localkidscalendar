-- Creative review via Supabase RPC (Safari-safe; no Vercel /api dependency)
-- URL safety checks + auto-approve when the link looks family-safe.
-- Community flagging remains the safety net for image issues.
-- Full OpenAI vision can be added later via Edge Function.

create or replace function public.review_creative_asset(p_asset_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_asset public.ad_library%rowtype;
  v_url text;
  v_host text;
  v_path text;
  v_reason text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_asset
  from public.ad_library
  where id = p_asset_id;

  if not found then
    raise exception 'Creative not found';
  end if;

  if v_asset.user_id <> v_uid
     and not exists (
       select 1 from public.profiles p
       where p.id = v_uid and p.role = 'admin'
     ) then
    raise exception 'Forbidden';
  end if;

  v_url := trim(coalesce(v_asset.link_url, ''));
  if v_url = '' then
    v_reason := 'A destination URL is required.';
    update public.ad_library
    set moderation_status = 'declined',
        moderation_notes = v_reason,
        moderation_date = now(),
        updated_at = now()
    where id = p_asset_id;
    return jsonb_build_object('status', 'declined', 'reason', v_reason);
  end if;

  if v_url !~* '^https?://' then
    v_url := 'https://' || v_url;
  end if;

  begin
    v_host := lower(substring(v_url from '://([^/]+)'));
    v_path := coalesce(substring(v_url from '://[^/]+(/.*)'), '/');
  exception when others then
    v_reason := 'The destination URL is not valid. Please enter a full working link (e.g. https://yourbusiness.com).';
    update public.ad_library
    set moderation_status = 'declined',
        moderation_notes = v_reason,
        moderation_date = now(),
        updated_at = now()
    where id = p_asset_id;
    return jsonb_build_object('status', 'declined', 'reason', v_reason);
  end;

  if v_host is null or v_host = '' then
    v_reason := 'The destination URL is not valid. Please enter a full working link (e.g. https://yourbusiness.com).';
    update public.ad_library
    set moderation_status = 'declined',
        moderation_notes = v_reason,
        moderation_date = now(),
        updated_at = now()
    where id = p_asset_id;
    return jsonb_build_object('status', 'declined', 'reason', v_reason);
  end if;

  if v_host in ('localhost', '127.0.0.1', '0.0.0.0', '::1')
     or v_host ~ '^10\.'
     or v_host ~ '^192\.168\.'
     or v_host ~ '^172\.(1[6-9]|2[0-9]|3[0-1])\.'
     or v_host ~ '^169\.254\.'
     or v_host ~ '\.local$'
     or v_host ~ '\.internal$' then
    v_reason := 'The destination URL points to a private or internal address and cannot be used.';
    update public.ad_library
    set moderation_status = 'declined',
        moderation_notes = v_reason,
        moderation_date = now(),
        updated_at = now()
    where id = p_asset_id;
    return jsonb_build_object('status', 'declined', 'reason', v_reason);
  end if;

  if (v_host || v_path) ~* '(porn|xxx|adult|sex|escort|nude|onlyfans|camgirl|gambling|casino|weed|cocaine|viagra)' then
    v_reason := 'The destination URL appears inappropriate for a family audience. Please use a safe, business-related link.';
    update public.ad_library
    set moderation_status = 'declined',
        moderation_notes = v_reason,
        moderation_date = now(),
        updated_at = now()
    where id = p_asset_id;
    return jsonb_build_object('status', 'declined', 'reason', v_reason);
  end if;

  update public.ad_library
  set link_url = v_url,
      moderation_status = 'approved',
      moderation_notes = '',
      moderation_date = now(),
      updated_at = now()
  where id = p_asset_id;

  return jsonb_build_object('status', 'approved', 'reason', '');
end;
$$;

grant execute on function public.review_creative_asset(uuid) to authenticated;
