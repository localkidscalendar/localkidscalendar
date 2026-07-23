-- Ad pricing history (admin rate changes over time)

create table if not exists public.ad_pricing_history (
  id uuid primary key default gen_random_uuid(),
  monthly_rate numeric not null,
  annual_discount_percent numeric not null,
  effective_date date not null,
  end_date date,
  notes text,
  set_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_pricing_history_effective_date_idx
  on public.ad_pricing_history (effective_date desc);

alter table public.ad_pricing_history enable row level security;

drop policy if exists "Admins manage ad pricing history" on public.ad_pricing_history;
create policy "Admins manage ad pricing history"
  on public.ad_pricing_history for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Supporters / public can read history so Current Ad Rates stays accurate (optional read)
drop policy if exists "Authenticated can read ad pricing history" on public.ad_pricing_history;
create policy "Authenticated can read ad pricing history"
  on public.ad_pricing_history for select
  using (auth.role() = 'authenticated');

grant select on public.ad_pricing_history to authenticated;
grant insert, update, delete on public.ad_pricing_history to authenticated;

-- Backfill one "current" history row from global config if history is empty
insert into public.ad_pricing_history (monthly_rate, annual_discount_percent, effective_date, notes)
select c.monthly_rate, c.annual_discount_percent, current_date, 'Initial rate from config'
from public.ad_pricing_config c
where c.config_key = 'global'
  and not exists (select 1 from public.ad_pricing_history limit 1);
