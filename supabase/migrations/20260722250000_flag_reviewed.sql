-- Soft-dismiss: Reviewed/Dismiss hides from admin list without deleting the report

alter table public.flag_reports
  add column if not exists reviewed boolean not null default false;

create index if not exists flag_reports_reviewed_idx
  on public.flag_reports (reviewed, created_at desc);

-- Admins can update reviewed status
drop policy if exists "Admins can update flag reports" on public.flag_reports;
create policy "Admins can update flag reports"
  on public.flag_reports for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

grant update on public.flag_reports to authenticated;
