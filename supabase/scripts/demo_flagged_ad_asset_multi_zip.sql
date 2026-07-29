-- =============================================================================
-- DEMO: Flagged Ad Asset across multiple zip placements
-- =============================================================================
-- Purpose: Preview what a Supporter sees after a creative is disabled (3+ flags
-- or Admin flag), when that same Ad Asset is used on more than one zip.
--
-- Target account: ekwatada@gmail.com
-- Uses their existing 89448 + 89449 placements (same creative on both if possible).
-- Also creates one approved alternate asset so Change Creative & Reactivate works.
--
-- After running:
--   1. Sign in as ekwatada@gmail.com
--   2. Open Ad Manager → My Ads → Inactive
--   3. You should see TWO inactive (Flagged) cards: Zip 89448 and Zip 89449
--   4. Each shows a note telling them to pick/create a different approved creative
--   5. Ad Library shows the shared creative as Disabled — Unavailable
--   6. Use "Change Creative & Reactivate" on EACH zip with
--      "Approved Demo Replacement" (or Add Asset a new one)
--
-- Safe to re-run.
-- =============================================================================

do $$
declare
  v_user_id uuid;
  v_flagged_asset_id uuid;
  v_replacement_id uuid;
  v_image text;
  v_link text;
  v_business text;
  v_note text :=
    'DEMO — This ad creative was disabled and can’t be reused. '
    || 'It was used on multiple zip placements, so every placement using it was paused. '
    || 'Open Change Creative & Reactivate on EACH affected zip and select a different '
    || 'approved creative (or create a new one). Billing stays active.';
  v_updated int;
begin
  select id into v_user_id
  from public.profiles
  where lower(email) = lower('ekwatada@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No profile found for ekwatada@gmail.com';
  end if;

  -- Prefer an existing library row already linked from either zip placement.
  select b.ad_library_id, b.image_url, b.link_url, coalesce(nullif(trim(b.business_name), ''), 'Test Ad')
  into v_flagged_asset_id, v_image, v_link, v_business
  from public.banner_ads b
  where b.user_id = v_user_id
    and b.zip_code in ('89448', '89449')
    and nullif(trim(b.image_url), '') is not null
    and nullif(trim(b.link_url), '') is not null
  order by
    case when b.ad_library_id is not null then 0 else 1 end,
    b.updated_at desc nulls last
  limit 1;

  if v_image is null or v_link is null then
    -- Fall back to any banner for this user.
    select b.ad_library_id, b.image_url, b.link_url, coalesce(nullif(trim(b.business_name), ''), 'Test Ad')
    into v_flagged_asset_id, v_image, v_link, v_business
    from public.banner_ads b
    where b.user_id = v_user_id
      and nullif(trim(b.image_url), '') is not null
      and nullif(trim(b.link_url), '') is not null
    order by b.updated_at desc nulls last
    limit 1;
  end if;

  if v_image is null or v_link is null then
    -- Fall back to any ad_library row for this user.
    select a.id, a.image_url, a.link_url, coalesce(nullif(trim(a.ad_name), ''), 'Test Ad')
    into v_flagged_asset_id, v_image, v_link, v_business
    from public.ad_library a
    where a.user_id = v_user_id
      and a.deleted_at is null
      and nullif(trim(a.image_url), '') is not null
      and nullif(trim(a.link_url), '') is not null
    order by a.created_at desc
    limit 1;
  end if;

  if v_image is null or v_link is null then
    raise exception
      'No image/link found for ekwatada@gmail.com. Create at least one Ad Library asset (or banner ad) with an image and link, then re-run.';
  end if;

  -- Ensure we have an ad_library row to mark flagged (create one if placements had no library id).
  if v_flagged_asset_id is null
     or not exists (
       select 1 from public.ad_library a
       where a.id = v_flagged_asset_id and a.user_id = v_user_id
     )
  then
    insert into public.ad_library (
      user_id, ad_name, image_url, link_url,
      moderation_status, moderation_notes, moderation_date, flagged_at
    ) values (
      v_user_id,
      v_business,
      v_image,
      v_link,
      'flagged',
      v_note,
      now(),
      now()
    )
    returning id into v_flagged_asset_id;
  else
    update public.ad_library
    set moderation_status = 'flagged',
        flagged_at = coalesce(flagged_at, now()),
        deleted_at = null,
        disable_notified_at = null,
        moderation_notes = v_note,
        image_url = coalesce(nullif(trim(image_url), ''), v_image),
        link_url = coalesce(nullif(trim(link_url), ''), v_link),
        updated_at = now()
    where id = v_flagged_asset_id
      and user_id = v_user_id;
  end if;

  -- Put BOTH zip placements into flagged/recoverable inactive state.
  update public.banner_ads
  set status = 'flagged',
      flag_count = greatest(coalesce(flag_count, 0), 3),
      cancelled_at = null,
      replacement_required = true,
      ad_library_id = v_flagged_asset_id,
      image_url = v_image,
      link_url = v_link,
      business_name = coalesce(nullif(trim(business_name), ''), v_business),
      -- Placement moderation_status is separate from Ad Library (no 'flagged' value here).
      moderation_status = 'approved',
      moderation_notes = v_note,
      updated_at = now()
  where user_id = v_user_id
    and zip_code in ('89448', '89449');

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    raise exception
      'No banner_ads found for zip 89448/89449 on this user. Create those placements first, then re-run.';
  end if;

  if v_updated = 1 then
    raise notice
      'Only % zip placement was updated. For the full multi-zip demo, both 89448 and 89449 should exist.',
      v_updated;
  end if;

  -- Approved alternate creative for recovery testing.
  select id into v_replacement_id
  from public.ad_library
  where user_id = v_user_id
    and ad_name = 'Approved Demo Replacement'
    and deleted_at is null
  limit 1;

  if v_replacement_id is null then
    insert into public.ad_library (
      user_id,
      ad_name,
      image_url,
      link_url,
      moderation_status,
      moderation_notes,
      moderation_date
    ) values (
      v_user_id,
      'Approved Demo Replacement',
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=900&h=600&fit=crop',
      'https://example.com/local-kids-demo',
      'approved',
      'DEMO approved asset — use this to reactivate each flagged zip.',
      now()
    )
    returning id into v_replacement_id;
  else
    update public.ad_library
    set moderation_status = 'approved',
        flagged_at = null,
        deleted_at = null,
        moderation_notes = 'DEMO approved asset — use this to reactivate each flagged zip.',
        updated_at = now()
    where id = v_replacement_id;
  end if;

  raise notice 'Demo ready for user %', v_user_id;
  raise notice 'Flagged asset: %', v_flagged_asset_id;
  raise notice 'Approved replacement asset: %', v_replacement_id;
  raise notice 'Updated % placement(s) to flagged', v_updated;
end $$;

-- Verify
select
  b.zip_code,
  b.status as placement_status,
  b.flag_count,
  b.cancelled_at,
  b.replacement_required,
  left(b.moderation_notes, 80) as placement_note_preview,
  a.ad_name,
  a.moderation_status as asset_status,
  a.flagged_at
from public.banner_ads b
join public.profiles p on p.id = b.user_id
left join public.ad_library a on a.id = b.ad_library_id
where lower(p.email) = lower('ekwatada@gmail.com')
order by b.zip_code;

select
  a.ad_name,
  a.moderation_status,
  a.flagged_at,
  a.deleted_at,
  left(coalesce(a.moderation_notes, ''), 80) as notes_preview
from public.ad_library a
join public.profiles p on p.id = a.user_id
where lower(p.email) = lower('ekwatada@gmail.com')
  and a.deleted_at is null
order by a.created_at desc;
