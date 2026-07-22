-- One organizer profile per user
create unique index if not exists organizers_user_id_unique
  on public.organizers (user_id);
