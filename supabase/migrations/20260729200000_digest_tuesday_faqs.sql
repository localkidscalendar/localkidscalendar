-- Update public FAQ copy: weekly digests send Tuesday mornings (PT), not Mondays.
update public.faqs
set answer = 'Weekly activity digests are optional and Off by default. In My Account → Email Notifications, choose Weekly and pick Favorite Organizers and/or Activity Matches (zip, keywords, age). Digests go out Tuesday mornings only when there are matching activities — you will not get an empty “nothing new” email. Each digest includes an unsubscribe link. Digests may turn Off automatically if your account is inactive for a long time, is disabled, or if an email bounce or spam complaint is reported; you can turn Weekly back on anytime after you return.',
    updated_at = now()
where answer ilike '%Monday mornings%'
   or answer ilike '%Digests go out Monday%';
