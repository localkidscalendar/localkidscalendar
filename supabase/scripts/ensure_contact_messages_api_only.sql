-- Ensure contact_messages cannot be inserted directly from the browser (anon key).
-- Safe to re-run. Apply after /api/contact-submit is live on Vercel.

drop policy if exists "Anyone can submit contact messages" on public.contact_messages;
revoke insert on public.contact_messages from anon, authenticated;
grant insert on public.contact_messages to service_role;
