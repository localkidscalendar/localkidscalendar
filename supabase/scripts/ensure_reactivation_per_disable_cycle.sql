-- Ensure script (run in Supabase SQL Editor). Same as migration 20260820160000.
-- One reactivation request per disable cycle: disabled users may reopen a stale
-- "reactivated" row after Admin disables them again.

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
