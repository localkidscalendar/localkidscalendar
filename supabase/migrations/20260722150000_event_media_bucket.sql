-- Public media bucket for activity photos / logos
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

drop policy if exists "Public can view event media" on storage.objects;
drop policy if exists "Authenticated users can upload event media" on storage.objects;
drop policy if exists "Owners can update own event media" on storage.objects;
drop policy if exists "Owners can delete own event media" on storage.objects;

create policy "Public can view event media"
  on storage.objects for select
  using (bucket_id = 'event-media');

create policy "Authenticated users can upload event media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-media');

create policy "Owners can update own event media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'event-media' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Owners can delete own event media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-media' and auth.uid()::text = (storage.foldername(name))[1]);
