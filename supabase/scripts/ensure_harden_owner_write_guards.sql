-- Harden owner writes:
-- 1) event-media uploads must land under the caller's user-id folder
-- 2) non-admin clients cannot change privileged columns on their own rows
--    (flag counters, Stripe fields, inbox content, waitlist queue fields, etc.)
-- SECURITY DEFINER RPCs still work: they run as postgres/supabase_admin and bypass these guards.

-- ---------------------------------------------------------------------------
-- Shared privilege check
-- ---------------------------------------------------------------------------
create or replace function public.is_privileged_db_actor()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return true;
  end if;
  -- SECURITY DEFINER RPCs / migrations typically execute as these roles
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    return true;
  end if;
  if auth.uid() is null then
    return true;
  end if;
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
end;
$$;

grant execute on function public.is_privileged_db_actor() to authenticated;
grant execute on function public.is_privileged_db_actor() to service_role;

-- ---------------------------------------------------------------------------
-- Storage: insert only into own folder (admins also use their own user id path)
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can upload event media" on storage.objects;
create policy "Authenticated users can upload event media"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Profiles: lock suspension / user-flag fields (extends role/disable guard)
-- ---------------------------------------------------------------------------
create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_db_actor() then
    return new;
  end if;

  -- Non-admins never touch disable metadata
  if new.role_before_disabled is distinct from old.role_before_disabled
     or new.disabled_note is distinct from old.disabled_note
     or new.disabled_at is distinct from old.disabled_at
     or new.disabled_by is distinct from old.disabled_by
  then
    raise exception 'Only admins can change account disable / role fields';
  end if;

  -- Suspension + community user-flag case fields
  if new.user_flag_count is distinct from old.user_flag_count
     or new.user_flagged_by is distinct from old.user_flagged_by
     or new.suspended_at is distinct from old.suspended_at
     or new.user_flag_case_admin_action is distinct from old.user_flag_case_admin_action
     or new.user_flag_case_admin_history is distinct from old.user_flag_case_admin_history
  then
    raise exception 'Only admins or system routines can change user flag / suspension fields';
  end if;

  if new.role is distinct from old.role then
    -- One-time setup: incomplete profiles (no zip yet) may choose CM or Organizer
    if coalesce(nullif(trim(old.zip_code), ''), '') = ''
       and old.role in ('community_member', 'organizer')
       and new.role in ('community_member', 'organizer')
    then
      return new;
    end if;

    raise exception 'Only admins can change account disable / role fields';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_non_admin_role_change on public.profiles;
create trigger profiles_prevent_non_admin_role_change
  before update on public.profiles
  for each row
  execute function public.prevent_non_admin_role_change();

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create or replace function public.protect_events_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_db_actor() then
    return new;
  end if;

  if new.created_by_id is distinct from old.created_by_id then
    raise exception 'Cannot transfer event ownership';
  end if;

  if new.flag_count is distinct from old.flag_count
     or new.flagged_by is distinct from old.flagged_by
     or new.save_count is distinct from old.save_count
     or new.view_count is distinct from old.view_count
     or new.impression_count is distinct from old.impression_count
  then
    raise exception 'Only admins or system routines can change event counters / flags';
  end if;

  if to_jsonb(new) ? 'flag_case_admin_action'
     and (
       new.flag_case_admin_action is distinct from old.flag_case_admin_action
       or new.flag_case_admin_history is distinct from old.flag_case_admin_history
     )
  then
    raise exception 'Only admins or system routines can change event flag case fields';
  end if;

  if to_jsonb(new) ? 'flag_auto_hide_exempt'
     and new.flag_auto_hide_exempt is distinct from old.flag_auto_hide_exempt
  then
    raise exception 'Only admins or system routines can change flag auto-hide exemption';
  end if;

  -- Owners may keep admin_notes empty on self-delete; cannot set or alter Admin notes
  if new.admin_notes is distinct from old.admin_notes then
    if coalesce(nullif(trim(old.admin_notes), ''), '') <> ''
       or coalesce(nullif(trim(new.admin_notes), ''), '') <> ''
    then
      raise exception 'Only admins can set or change admin notes on activities';
    end if;
  end if;

  -- Owners soft-delete with deleted; community auto-hide uses archived (RPC only)
  if new.status is distinct from old.status then
    if old.status = 'archived' then
      raise exception 'Only admins or system routines can change archived activity status';
    end if;
    if new.status not in ('active', 'deleted', 'expired') then
      raise exception 'Invalid activity status change for owners';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists events_protect_privileged_columns on public.events;
create trigger events_protect_privileged_columns
  before update on public.events
  for each row
  execute function public.protect_events_privileged_columns();

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create or replace function public.protect_comments_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_db_actor() then
    return new;
  end if;

  if new.created_by_id is distinct from old.created_by_id then
    raise exception 'Cannot transfer comment ownership';
  end if;

  if new.flag_count is distinct from old.flag_count
     or new.flagged_by is distinct from old.flagged_by
  then
    raise exception 'Only admins or system routines can change comment flags';
  end if;

  if to_jsonb(new) ? 'flag_case_admin_action'
     and (
       new.flag_case_admin_action is distinct from old.flag_case_admin_action
       or new.flag_case_admin_history is distinct from old.flag_case_admin_history
     )
  then
    raise exception 'Only admins or system routines can change comment flag case fields';
  end if;

  if to_jsonb(new) ? 'flag_auto_hide_exempt'
     and new.flag_auto_hide_exempt is distinct from old.flag_auto_hide_exempt
  then
    raise exception 'Only admins or system routines can change flag auto-hide exemption';
  end if;

  if new.status is distinct from old.status then
    if old.status = 'archived' then
      raise exception 'Only admins or system routines can change archived comment status';
    end if;
    if new.status not in ('active', 'deleted') then
      raise exception 'Invalid comment status change for owners';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_protect_privileged_columns on public.comments;
create trigger comments_protect_privileged_columns
  before update on public.comments
  for each row
  execute function public.protect_comments_privileged_columns();

-- ---------------------------------------------------------------------------
-- Ad library
-- ---------------------------------------------------------------------------
create or replace function public.protect_ad_library_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_db_actor() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Cannot transfer ad library ownership';
  end if;

  if to_jsonb(new) ? 'flag_count'
     and (
       new.flag_count is distinct from old.flag_count
       or (to_jsonb(new) ? 'flagged_by' and new.flagged_by is distinct from old.flagged_by)
     )
  then
    raise exception 'Only admins or system routines can change ad asset flags';
  end if;

  if to_jsonb(new) ? 'flag_case_admin_action'
     and (
       new.flag_case_admin_action is distinct from old.flag_case_admin_action
       or new.flag_case_admin_history is distinct from old.flag_case_admin_history
     )
  then
    raise exception 'Only admins or system routines can change ad asset flag case fields';
  end if;

  if to_jsonb(new) ? 'flag_auto_hide_exempt'
     and new.flag_auto_hide_exempt is distinct from old.flag_auto_hide_exempt
  then
    raise exception 'Only admins or system routines can change flag auto-hide exemption';
  end if;

  if to_jsonb(new) ? 'disable_notified_at'
     and new.disable_notified_at is distinct from old.disable_notified_at
  then
    raise exception 'Only system routines can change ad disable notification markers';
  end if;

  if to_jsonb(new) ? 'deleted_at'
     and new.deleted_at is distinct from old.deleted_at
  then
    raise exception 'Use the delete-ad-asset flow to remove library assets';
  end if;

  -- Owners may request manual review or keep pending; cannot self-approve / flag
  if new.moderation_status is distinct from old.moderation_status
     and new.moderation_status not in ('pending', 'manual_review')
  then
    raise exception 'Owners cannot set ad asset moderation to %', new.moderation_status;
  end if;

  return new;
end;
$$;

drop trigger if exists ad_library_protect_privileged_columns on public.ad_library;
create trigger ad_library_protect_privileged_columns
  before update on public.ad_library
  for each row
  execute function public.protect_ad_library_privileged_columns();

-- ---------------------------------------------------------------------------
-- Banner ads (placements)
-- ---------------------------------------------------------------------------
create or replace function public.protect_banner_ads_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_db_actor() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Cannot transfer ad ownership';
  end if;

  if new.stripe_subscription_id is distinct from old.stripe_subscription_id
     or new.stripe_customer_id is distinct from old.stripe_customer_id
     or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
     or new.rate_at_purchase is distinct from old.rate_at_purchase
     or new.plan_start_date is distinct from old.plan_start_date
     or new.plan_end_date is distinct from old.plan_end_date
     or new.next_renewal_date is distinct from old.next_renewal_date
     or new.discount_code_used is distinct from old.discount_code_used
     or new.impressions is distinct from old.impressions
     or new.clicks is distinct from old.clicks
     or new.flag_count is distinct from old.flag_count
     or new.flagged_by is distinct from old.flagged_by
  then
    raise exception 'Only admins or billing/system routines can change billing, metrics, or flag fields on ads';
  end if;

  if to_jsonb(new) ? 'upgrade_to_annual_pending'
     and (
       new.upgrade_to_annual_pending is distinct from old.upgrade_to_annual_pending
       or new.downgrade_to_monthly_pending is distinct from old.downgrade_to_monthly_pending
     )
  then
    raise exception 'Use the plan-change API to schedule ad plan switches';
  end if;

  if to_jsonb(new) ? 'cancelled_at'
     and new.cancelled_at is distinct from old.cancelled_at
  then
    raise exception 'Only billing/system routines can change ad cancellation timestamps';
  end if;

  if to_jsonb(new) ? 'grace_period_start'
     and new.grace_period_start is distinct from old.grace_period_start
  then
    raise exception 'Only billing/system routines can change ad grace period fields';
  end if;

  -- Recoverable creative swap may reactivate flagged/rejected placements
  if new.status is distinct from old.status then
    if not (
      old.status in ('flagged', 'rejected')
      and new.status = 'active'
    ) then
      raise exception 'Owners cannot set ad status from % to %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists banner_ads_protect_privileged_columns on public.banner_ads;
create trigger banner_ads_protect_privileged_columns
  before update on public.banner_ads
  for each row
  execute function public.protect_banner_ads_privileged_columns();

-- ---------------------------------------------------------------------------
-- Ad waitlist
-- ---------------------------------------------------------------------------
create or replace function public.protect_ad_waitlist_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_db_actor() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'Cannot transfer waitlist ownership';
  end if;

  if new.position is distinct from old.position
     or new.offer_sent_date is distinct from old.offer_sent_date
     or new.offer_expires_date is distinct from old.offer_expires_date
     or new.offer_count is distinct from old.offer_count
     or new.admin_override_notes is distinct from old.admin_override_notes
  then
    raise exception 'Only admins or system routines can change waitlist queue / offer fields';
  end if;

  if new.zip_code is distinct from old.zip_code then
    raise exception 'Cannot change waitlist zip code after joining';
  end if;

  if new.status is distinct from old.status then
    if old.status not in ('waiting', 'offered')
       or new.status not in ('cancelled', 'declined')
    then
      raise exception 'Owners may only cancel or decline active waitlist entries';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists ad_waitlist_protect_privileged_columns on public.ad_waitlist;
create trigger ad_waitlist_protect_privileged_columns
  before update on public.ad_waitlist
  for each row
  execute function public.protect_ad_waitlist_privileged_columns();

-- ---------------------------------------------------------------------------
-- User messages: owners may only mark read / soft-delete
-- ---------------------------------------------------------------------------
create or replace function public.protect_user_messages_content()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_privileged_db_actor() then
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.subject is distinct from old.subject
     or new.body is distinct from old.body
     or new.template_key is distinct from old.template_key
     or new.source is distinct from old.source
     or new.action_label is distinct from old.action_label
     or new.action_href is distinct from old.action_href
     or new.related_type is distinct from old.related_type
     or new.related_id is distinct from old.related_id
     or new.mass_message_id is distinct from old.mass_message_id
     or new.metadata is distinct from old.metadata
     or new.created_at is distinct from old.created_at
  then
    raise exception 'Users may only mark messages read or delete them';
  end if;

  return new;
end;
$$;

drop trigger if exists user_messages_protect_content on public.user_messages;
create trigger user_messages_protect_content
  before update on public.user_messages
  for each row
  execute function public.protect_user_messages_content();
