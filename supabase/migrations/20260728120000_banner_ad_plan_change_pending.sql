-- Pending monthly ↔ annual plan switches (locks in ~21 days before renewal)

alter table public.banner_ads
  add column if not exists upgrade_to_annual_pending boolean not null default false,
  add column if not exists upgrade_requested_date timestamptz,
  add column if not exists upgrade_locked_annual_rate numeric,
  add column if not exists downgrade_to_monthly_pending boolean not null default false,
  add column if not exists downgrade_requested_date timestamptz,
  add column if not exists downgrade_locked_monthly_rate numeric;

comment on column public.banner_ads.upgrade_to_annual_pending is
  'Monthly Supporter requested switch to annual at next renewal.';
comment on column public.banner_ads.downgrade_to_monthly_pending is
  'Annual Supporter requested switch to monthly at next renewal.';
