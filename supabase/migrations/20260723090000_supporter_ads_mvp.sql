-- Supporter ads MVP (display + library + admin activate; Stripe later)

-- Pricing (read-only for public display)
create table if not exists public.ad_pricing_config (
  id uuid primary key default gen_random_uuid(),
  config_key text not null unique default 'global',
  monthly_rate numeric not null default 150,
  annual_discount_percent numeric not null default 30,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Zip slot capacity
create table if not exists public.ad_zip_config (
  id uuid primary key default gen_random_uuid(),
  zip_code text not null unique,
  max_slots numeric not null default 3,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reusable creatives
create table if not exists public.ad_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  ad_name text not null,
  image_url text not null,
  link_url text not null,
  moderation_status text not null default 'pending'
    check (moderation_status in (
      'pending', 'approved', 'declined', 'manual_review', 'manual_review_declined'
    )),
  moderation_notes text,
  moderation_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_library_user_id_idx on public.ad_library (user_id);
create index if not exists ad_library_moderation_status_idx on public.ad_library (moderation_status);

-- Live / requested placements
create table if not exists public.banner_ads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_name text not null,
  image_url text not null,
  link_url text not null,
  zip_code text not null,
  status text not null default 'pending_review'
    check (status in (
      'pending_payment', 'pending_review', 'active', 'past_due',
      'rejected', 'expired', 'cancelled', 'flagged'
    )),
  moderation_status text not null default 'needs_review'
    check (moderation_status in ('auto_approved', 'needs_review', 'approved', 'rejected')),
  moderation_notes text,
  plan_type text not null default 'monthly' check (plan_type in ('monthly', 'annual')),
  plan_start_date date,
  plan_end_date date,
  next_renewal_date date,
  rate_at_purchase numeric,
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_payment_intent_id text,
  discount_code_used text,
  auto_renew boolean not null default true,
  impressions numeric not null default 0,
  clicks numeric not null default 0,
  flag_count numeric not null default 0,
  flagged_by text[] not null default '{}',
  ad_library_id uuid references public.ad_library (id) on delete set null,
  tos_accepted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists banner_ads_zip_status_idx on public.banner_ads (zip_code, status);
create index if not exists banner_ads_user_id_idx on public.banner_ads (user_id);
create index if not exists banner_ads_status_idx on public.banner_ads (status);

alter table public.ad_pricing_config enable row level security;
alter table public.ad_zip_config enable row level security;
alter table public.ad_library enable row level security;
alter table public.banner_ads enable row level security;

-- Pricing: public read, admin write
drop policy if exists "Ad pricing is publicly readable" on public.ad_pricing_config;
create policy "Ad pricing is publicly readable"
  on public.ad_pricing_config for select using (true);

drop policy if exists "Admins manage ad pricing" on public.ad_pricing_config;
create policy "Admins manage ad pricing"
  on public.ad_pricing_config for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Zip config: public read, admin write
drop policy if exists "Ad zip config is publicly readable" on public.ad_zip_config;
create policy "Ad zip config is publicly readable"
  on public.ad_zip_config for select using (true);

drop policy if exists "Admins manage ad zip config" on public.ad_zip_config;
create policy "Admins manage ad zip config"
  on public.ad_zip_config for all
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Ad library: owner + admin
drop policy if exists "Users read own ad library" on public.ad_library;
create policy "Users read own ad library"
  on public.ad_library for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Users insert own ad library" on public.ad_library;
create policy "Users insert own ad library"
  on public.ad_library for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users update own ad library" on public.ad_library;
create policy "Users update own ad library"
  on public.ad_library for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Users delete own ad library" on public.ad_library;
create policy "Users delete own ad library"
  on public.ad_library for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Banner ads: public read active; owners read own; owners insert; owners+admins update/delete
drop policy if exists "Active banner ads are publicly readable" on public.banner_ads;
create policy "Active banner ads are publicly readable"
  on public.banner_ads for select
  using (
    status = 'active'
    or auth.uid() = user_id
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Users insert own banner ads" on public.banner_ads;
create policy "Users insert own banner ads"
  on public.banner_ads for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Owners and admins update banner ads" on public.banner_ads;
create policy "Owners and admins update banner ads"
  on public.banner_ads for update
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Owners and admins delete banner ads" on public.banner_ads;
create policy "Owners and admins delete banner ads"
  on public.banner_ads for delete
  to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

grant select on public.ad_pricing_config to anon, authenticated;
grant insert, update, delete on public.ad_pricing_config to authenticated;
grant select on public.ad_zip_config to anon, authenticated;
grant insert, update, delete on public.ad_zip_config to authenticated;
grant select, insert, update, delete on public.ad_library to authenticated;
grant select on public.banner_ads to anon, authenticated;
grant insert, update, delete on public.banner_ads to authenticated;

insert into public.ad_pricing_config (config_key, monthly_rate, annual_discount_percent)
values ('global', 150, 30)
on conflict (config_key) do nothing;

-- Extend flagging RPC to support ads
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
  v_owner_id uuid;
  v_flagged_by text[];
  v_count numeric;
  v_new_count numeric;
  v_archived boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_type not in ('event', 'comment', 'ad') then
    raise exception 'Invalid target type';
  end if;

  if p_reason not in ('inaccurate', 'inappropriate', 'spam', 'other') then
    raise exception 'Invalid reason';
  end if;

  if p_reason = 'other' and nullif(trim(coalesce(p_details, '')), '') is null then
    raise exception 'Details required for other';
  end if;

  if exists (
    select 1 from public.flag_reports
    where reporter_id = v_uid
      and target_type = p_target_type
      and target_id = p_target_id
  ) then
    raise exception 'You already flagged this item';
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
      )
    into v_flagged_by, v_count, v_owner_id, v_contributor
    from public.events e
    where e.id = p_target_id and e.status = 'active';
    if not found then raise exception 'Event not found or not active'; end if;

  elsif p_target_type = 'comment' then
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
      )
    into v_flagged_by, v_count, v_owner_id, v_contributor
    from public.comments c
    where c.id = p_target_id and c.status = 'active';
    if not found then raise exception 'Comment not found or not active'; end if;

  else
    select
      coalesce(a.flagged_by, '{}'),
      coalesce(a.flag_count, 0),
      a.user_id,
      coalesce(nullif(trim(a.business_name), ''), 'Ad')
    into v_flagged_by, v_count, v_owner_id, v_contributor
    from public.banner_ads a
    where a.id = p_target_id and a.status = 'active';
    if not found then raise exception 'Ad not found or not active'; end if;
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

  insert into public.flag_reports (
    target_type, target_id, reason, details, reporter_id, reporter_name, target_contributor_name
  ) values (
    p_target_type,
    p_target_id,
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
    where id = p_target_id;
  elsif p_target_type = 'comment' then
    update public.comments
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        status = case when v_archived then 'archived' else status end,
        updated_at = now()
    where id = p_target_id;
  else
    update public.banner_ads
    set flag_count = v_new_count,
        flagged_by = v_flagged_by,
        status = case when v_archived then 'flagged' else status end,
        updated_at = now()
    where id = p_target_id;
  end if;

  return jsonb_build_object('flag_count', v_new_count, 'archived', v_archived);
end;
$$;
