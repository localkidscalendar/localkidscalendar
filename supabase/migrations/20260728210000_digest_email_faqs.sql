-- Align FAQ copy with weekly-only digests + auto-off safeguards.

update public.faqs
set answer = 'Weekly activity digests are optional and Off by default. In My Account → Email Notifications, choose Weekly and pick Favorite Organizers and/or Activity Matches (zip, keywords, age). Digests go out Monday mornings only when there are matching activities — you will not get an empty “nothing new” email. Each digest includes an unsubscribe link. Digests may turn Off automatically if your account is inactive for a long time, is disabled, or if an email bounce or spam complaint is reported; you can turn Weekly back on anytime after you return.',
    updated_at = now()
where question = 'What are notification preferences and how do I set them up?';

insert into public.faqs (question, answer, category, sort_order, status)
select
  'Will I keep getting weekly digest emails if I stop using the site?',
  'No. Weekly digests are Off by default, and we only send them when there are activities that match your preferences. If you do not sign in for an extended period, we automatically turn Weekly digests Off to avoid unnecessary email. Disabled accounts do not receive digests. You can also unsubscribe from any digest email in one click, or manage preferences anytime under My Account → Email Notifications.',
  'Accounts',
  2.5::numeric,
  'active'
where not exists (
  select 1 from public.faqs
  where question = 'Will I keep getting weekly digest emails if I stop using the site?'
);
