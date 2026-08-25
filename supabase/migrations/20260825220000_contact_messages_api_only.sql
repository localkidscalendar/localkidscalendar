-- Contact messages: inserts only via /api/contact-submit (service role).
-- Run in Supabase SQL Editor after deploy if migrations are applied manually.

drop policy if exists "Anyone can submit contact messages" on public.contact_messages;

revoke insert on public.contact_messages from anon, authenticated;

grant insert on public.contact_messages to service_role;
