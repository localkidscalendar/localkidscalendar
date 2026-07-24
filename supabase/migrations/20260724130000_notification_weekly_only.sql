-- Restrict notification digests to weekly | off only (default remains none/off).

-- Coerce any legacy daily/monthly rows to off (safer than auto-upgrading cadence).
update public.notification_preferences
set frequency = 'none', updated_at = now()
where frequency in ('daily', 'monthly');

alter table public.notification_preferences
  drop constraint if exists notification_preferences_frequency_check;

alter table public.notification_preferences
  add constraint notification_preferences_frequency_check
  check (frequency in ('weekly', 'none'));
