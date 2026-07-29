-- Keep public FAQ copy aligned with current homepage Activity filter behavior
-- and profile zip / distance defaults.

update public.faqs
set answer = 'Use the search and filter tools on the homepage. Most filters work together — an Activity must match EVERY option you set (category, age, zip/radius, dates, price or Free, and so on). Search is the exception: if you type more than one word, an Activity matches when any of those words appear in the title, description, keywords, organizer name, or city. Each extra filter can shrink the results, so start broad if the list looks empty. Your filter choices stay for the rest of this browser session (or until you clear them). Signed-in users can also use special buttons on the filter bar: Saved Activities further narrows results to activities you''ve bookmarked (still combined with your other filters); Fav Organizers further narrows to activities from your favorite organizers (also combined with your other filters); and My Filters applies the preferences you saved under My Account → My Filters. Saved Activities, Fav Organizers, and My Filters can''t be used at the same time — choosing one turns the others off. If you change a filter after applying My Filters, the My Filters button turns off because the current filters no longer match what you saved. You can also set up notification preferences in your account to receive weekly emails about new activities matching your interests and zip code.',
    updated_at = now()
where question = 'How can I find activities in my area?';

update public.faqs
set answer = 'Yes! Click the bookmark/save icon on any activity card to add it to your saved list. Access your saved activities anytime from My Account → Saved Activities. On the homepage, signed-in users can also use the Saved Activities filter button to show only bookmarked activities (combined with any other filters you already set).',
    updated_at = now()
where question = 'Can I save activities to view later?';

update public.faqs
set answer = 'The site is centered around providing local events, so a location is required to determine what local means. If a user is not logged in, the site uses geolocation to determine a zip code (default search distance is 15 miles). If the user does not allow geolocation for the browser session, the user is required to manually provide a zip code or log in. If a user has an account and is logged in, the zip code and preferred distance in the user''s profile are used for the session. You set both when you create an account, and you can update them anytime in My Account → Profile. If a user manually changes the zip code or distance in the activity filters, those values are used for the rest of the browser session (unless cleared by the user, which defaults back to as it was when the session was started).',
    updated_at = now()
where question = 'Why can’t I view the site without a zip code?';
