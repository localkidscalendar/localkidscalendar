-- Stripe billing lifecycle columns for banner_ads (discount_amount already added earlier)

alter table public.banner_ads
  add column if not exists cancelled_at timestamptz,
  add column if not exists grace_period_start timestamptz,
  add column if not exists admin_override boolean not null default false,
  add column if not exists notes text;
