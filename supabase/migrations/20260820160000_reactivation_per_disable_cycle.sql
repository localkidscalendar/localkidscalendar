-- Allow one reactivation request per disable cycle (not lifetime).
-- When Admin disables again after a prior approval, the stale "reactivated" row
-- may be reopened by the disabled user; Admin Disable also deletes prior rows.

drop policy if exists "Disabled users can reopen reactivated request" on public.account_reactivation_requests;
create policy "Disabled users can reopen reactivated request"
  on public.account_reactivation_requests for update
  to authenticated
  using (
    user_id = auth.uid()
    and status = 'reactivated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'disabled'
    )
  )
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'disabled'
    )
  );
