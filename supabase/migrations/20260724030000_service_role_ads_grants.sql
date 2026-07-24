-- Stripe checkout / webhook APIs use the service_role key.
-- Tables created via SQL Editor only granted anon/authenticated, so inserts
-- fail with: permission denied for table banner_ads

grant all on table public.banner_ads to service_role;
grant all on table public.ad_library to service_role;
grant all on table public.ad_zip_config to service_role;
grant all on table public.ad_pricing_config to service_role;
grant all on table public.ad_waitlist to service_role;
grant all on table public.discount_codes to service_role;
grant all on table public.profiles to service_role;
grant all on table public.admin_default_ads to service_role;
grant all on table public.ad_pricing_history to service_role;

grant usage, select on all sequences in schema public to service_role;
