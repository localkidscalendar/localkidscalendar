-- Community flagging for events + comments

create table if not exists public.flag_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('event', 'comment', 'ad')),
  target_id uuid not null,
  reason text not null check (reason in ('inaccurate', 'inappropriate', 'spam', 'other')),
  details text,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reporter_name text,
  target_contributor_name text,
  created_at timestamptz not null default now()
);

create unique index if not exists flag_reports_one_per_user_target_idx
  on public.flag_reports (reporter_id, target_type, target_id);

create index if not exists flag_reports_target_idx
  on public.flag_reports (target_type, target_id);

create index if not exists flag_reports_created_at_idx
  on public.flag_reports (created_at desc);

alter table public.flag_reports enable row level security;

drop policy if exists "Users can read own flag reports" on public.flag_reports;
create policy "Users can read own flag reports"
  on public.flag_reports for select
  to authenticated
  using (
    reporter_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can delete flag reports" on public.flag_reports;
create policy "Admins can delete flag reports"
  on public.flag_reports for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Inserts go through submit_flag (security definer); no direct insert policy needed.

grant select, delete on public.flag_reports to authenticated;

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
  v_flagged_by text[];
  v_count numeric;
  v_new_count numeric;
  v_archived boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_target_type not in ('event', 'comment') then
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
    nullif(trim(concat(coalesce(first_name, ''), ' ', coalesce(last_name, ''))), ''),
    email,
    'Member'
  )
  into v_name
  from public.profiles
  where id = v_uid;

  if p_target_type = 'event' then
    select coalesce(flagged_by, '{}'), coalesce(flag_count, 0), title
    into v_flagged_by, v_count, v_contributor
    from public.events
    where id = p_target_id and status = 'active';

    if not found then
      raise exception 'Event not found or not active';
    end if;
  else
    select coalesce(flagged_by, '{}'), coalesce(flag_count, 0), coalesce(author_name, 'Comment')
    into v_flagged_by, v_count, v_contributor
    from public.comments
    where id = p_target_id and status = 'active';

    if not found then
      raise exception 'Comment not found or not active';
    end if;
  end if;

  if v_uid::text = any (v_flagged_by) then
    raise exception 'You already flagged this item';
  end if;

  v_new_count := v_count + 1;
  v_flagged_by := array_append(v_flagged_by, v_uid::text);
  v_archived := v_new_count >= 3;

  insert into public.flag_reports (
    target_type,
    target_id,
    reason,
    details,
    reporter_id,
    reporter_name,
    target_contributor_name
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
    set
      flag_count = v_new_count,
      flagged_by = v_flagged_by,
      status = case when v_archived then 'archived' else status end,
      updated_at = now()
    where id = p_target_id;
  else
    update public.comments
    set
      flag_count = v_new_count,
      flagged_by = v_flagged_by,
      status = case when v_archived then 'archived' else status end,
      updated_at = now()
    where id = p_target_id;
  end if;

  return jsonb_build_object(
    'flag_count', v_new_count,
    'archived', v_archived
  );
end;
$$;

revoke all on function public.submit_flag(text, uuid, text, text) from public;
grant execute on function public.submit_flag(text, uuid, text, text) to authenticated;
