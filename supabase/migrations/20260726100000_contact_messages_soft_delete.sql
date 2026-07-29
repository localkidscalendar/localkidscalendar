-- Soft-delete support for Admin Messages; simplify status to open vs addressed.
alter table public.contact_messages
  add column if not exists deleted_at timestamptz;

-- "read" was an intermediate state; treat as still needing attention.
update public.contact_messages
set status = 'unread'
where status = 'read';
