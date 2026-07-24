-- Favorite organizers digest option defaults to off (matches UI).

alter table public.notification_preferences
  alter column include_fav_organizers set default false;
