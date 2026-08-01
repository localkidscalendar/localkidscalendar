-- Ensure: archive-on-disable saver notices use admin_notes when set.
-- Pair with api/admin-disable-user.js content hide.

create or replace function public.trg_notify_on_content_hidden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'events' then
    if new.status = 'archived' and old.status is distinct from 'archived' then
      perform public.notify_savers_activity_removed(
        new.id,
        coalesce(
          nullif(trim(coalesce(new.admin_notes, '')), ''),
          'Removed after community flagging.'
        )
      );
    elsif new.status = 'deleted'
      and old.status is distinct from 'deleted'
      and nullif(trim(coalesce(new.admin_notes, '')), '') is not null
    then
      perform public.notify_savers_activity_removed(new.id, new.admin_notes);
    end if;
  end if;

  return new;
end;
$$;
