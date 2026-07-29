-- Admin can retract a mass message: soft-delete from all inboxes and remove archive row.

create or replace function public.retract_mass_message(p_mass_message_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count numeric := 0;
begin
  if auth.uid() is null
     or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only admins can retract mass messages';
  end if;

  if p_mass_message_id is null then
    raise exception 'mass message id is required';
  end if;

  if not exists (select 1 from public.mass_messages where id = p_mass_message_id) then
    raise exception 'Mass message not found';
  end if;

  update public.user_messages
  set deleted_at = coalesce(deleted_at, now())
  where mass_message_id = p_mass_message_id
    and deleted_at is null;

  get diagnostics v_count = row_count;

  delete from public.mass_messages
  where id = p_mass_message_id;

  return v_count;
end;
$$;

grant execute on function public.retract_mass_message(uuid) to authenticated;
grant execute on function public.retract_mass_message(uuid) to service_role;
