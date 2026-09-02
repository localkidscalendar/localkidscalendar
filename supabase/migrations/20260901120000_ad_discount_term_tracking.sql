-- Track how long a checkout discount applies and how many paid terms have used it.
alter table public.banner_ads
  add column if not exists discount_renewals_applicable numeric,
  add column if not exists discount_cycles_used numeric not null default 0;
