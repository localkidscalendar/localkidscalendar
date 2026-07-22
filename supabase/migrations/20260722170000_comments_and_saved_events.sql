-- Comments + saved events

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by_id uuid references public.profiles (id) on delete set null,
  content text not null,
  author_name text,
  flag_count numeric not null default 0,
  flagged_by text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'deleted', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_event_id_idx on public.comments (event_id);
create index if not exists comments_created_by_id_idx on public.comments (created_by_id);

alter table public.comments enable row level security;

create policy "Active comments are publicly readable"
  on public.comments for select
  using (
    status = 'active'
    or auth.uid() = created_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Authenticated users can create comments"
  on public.comments for insert
  to authenticated
  with check (auth.uid() = created_by_id);

create policy "Owners and admins can update comments"
  on public.comments for update
  to authenticated
  using (
    auth.uid() = created_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create policy "Owners and admins can delete comments"
  on public.comments for delete
  to authenticated
  using (
    auth.uid() = created_by_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create table if not exists public.saved_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists saved_events_user_id_idx on public.saved_events (user_id);
create index if not exists saved_events_event_id_idx on public.saved_events (event_id);

alter table public.saved_events enable row level security;

create policy "Users can read own saved events"
  on public.saved_events for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can save events"
  on public.saved_events for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can unsave events"
  on public.saved_events for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.comments to authenticated;
grant select on public.comments to anon;
grant select, insert, delete on public.saved_events to authenticated;
