-- Favorite organizers

create table if not exists public.favorite_organizers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organizer_id uuid references public.organizers (id) on delete cascade,
  poster_user_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists favorite_organizers_user_organizer_uidx
  on public.favorite_organizers (user_id, organizer_id)
  where organizer_id is not null;

create unique index if not exists favorite_organizers_user_poster_uidx
  on public.favorite_organizers (user_id, poster_user_id)
  where poster_user_id is not null;

create index if not exists favorite_organizers_user_id_idx
  on public.favorite_organizers (user_id);

alter table public.favorite_organizers enable row level security;

create policy "Users can read own favorite organizers"
  on public.favorite_organizers for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can add favorite organizers"
  on public.favorite_organizers for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove favorite organizers"
  on public.favorite_organizers for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.favorite_organizers to authenticated;
