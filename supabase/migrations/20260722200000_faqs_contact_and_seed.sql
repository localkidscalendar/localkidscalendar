-- FAQs + contact messages

create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  category text not null,
  sort_order numeric not null default 0,
  status text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists faqs_status_sort_idx on public.faqs (status, sort_order);

alter table public.faqs enable row level security;

drop policy if exists "Active FAQs are publicly readable" on public.faqs;
create policy "Active FAQs are publicly readable"
  on public.faqs for select
  using (
    status = 'active'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can insert FAQs" on public.faqs;
create policy "Admins can insert FAQs"
  on public.faqs for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update FAQs" on public.faqs;
create policy "Admins can update FAQs"
  on public.faqs for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can delete FAQs" on public.faqs;
create policy "Admins can delete FAQs"
  on public.faqs for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null,
  sender_email text not null,
  sender_phone text,
  subject text not null,
  message text not null,
  status text not null default 'unread' check (status in ('unread', 'read', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

drop policy if exists "Anyone can submit contact messages" on public.contact_messages;
create policy "Anyone can submit contact messages"
  on public.contact_messages for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins can read contact messages" on public.contact_messages;
create policy "Admins can read contact messages"
  on public.contact_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update contact messages" on public.contact_messages;
create policy "Admins can update contact messages"
  on public.contact_messages for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can delete contact messages" on public.contact_messages;
create policy "Admins can delete contact messages"
  on public.contact_messages for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

grant select on public.faqs to anon, authenticated;
grant insert, update, delete on public.faqs to authenticated;
grant insert on public.contact_messages to anon, authenticated;
grant select, update, delete on public.contact_messages to authenticated;


-- Seed FAQs from Base44 export (skip if already populated)
insert into public.faqs (question, answer, category, sort_order, status)
select * from (values
  ('How are activity photos reviewed before they go live?', 'Any photo uploaded with an activity is automatically screened by AI to keep images appropriate for a family site. Most photos are approved instantly. If the AI isn''t sure, the photo is held for a quick manual review by our admin team — you''ll get an email once it''s approved or, if declined, an email explaining why (and the photo will be removed from your listing so you can try a different one).', 'Activities', 18.5::numeric, 'active') ,
  ('Are there discount codes available for advertising?', 'Sometimes! Admins occasionally issue discount codes for a percentage off monthly or annual plans. If you have a code, you can enter it during checkout and you''ll see the discounted price previewed before you pay. Codes may have expiration dates, usage limits, or be restricted to a specific email address.', 'Supporters', 22.1::numeric, 'active') ,
  ('What is the Ad Library and can I reuse an ad design?', 'Yes! Your Ad Library stores approved ad creatives (images and links) so you can reuse them the next time you buy or renew a zip code slot instead of re-uploading and waiting for re-approval every time. New or edited assets still go through a quick review before they can be used, and assets currently used by a live ad can''t be deleted.', 'Supporters', 22.2::numeric, 'active') ,
  ('Can I switch my Supporter plan between monthly and annual billing?', 'Yes. From your Ad Manager, a monthly Supporter can request to switch to the annual plan (locking in the annual discount), and an annual Supporter can request to switch back to monthly. The switch takes effect at your next renewal date, and the new rate is locked in 21 days ahead of that renewal so there are no surprises.', 'Supporters', 23.5::numeric, 'active') ,
  ('What happens if my ad payment fails or my ad is flagged?', 'If a renewal payment fails, your ad is marked Past Due and you get a 7-day grace period to update your payment method before the ad is removed. If community members flag your ad 3+ times, or an admin manually flags/rejects/pauses it, the ad is marked unavailable and you''ll always receive an email explaining the reason.', 'Supporters', 24.5::numeric, 'active') ,
  ('What happens if I choose not to renew my ad?', 'You can turn off auto-renew anytime from Ad Manager. Starting 14 days before your renewal date, you''ll see a cancellation warning banner on your ad. Depending on how close you are to that renewal date, your ad will either stop immediately or keep running until the end of the term you''ve already paid for — the cancellation screen will tell you exactly which applies before you confirm.', 'Supporters', 24.6::numeric, 'active') ,
  ('Why can’t I view the site without a zip code?', 'The site is centered around providing local events, so a location is required to determine what local means. If a user is not logged in, the site uses geolocation to determine a zip code. If the user does not allow geolocation for the browser session, the user is required to manually provide a zip code or log in. If a user has an account and is logged in, the zip code in the user’s profile is used for the session. If a user manually changes the zip code in the activity filters, the zip code entered will be used for the rest of the browser session (unless cleared by the user, which defaults back to as it was when the session was started). ', 'Activities', 10.0::numeric, 'active') ,
  ('Can I update or remove an activity I posted?', 'Yes, you can edit or delete your own activities from your Dashboard. If you need to make changes to an activity you didn''t post, use the flag feature to report inaccuracies and our admin team will review it.', 'Activities', 13.0::numeric, 'active') ,
  ('What is a Supporter?', 'Supporters are local businesses and organizations that advertise on LocalKidsCalendar to help keep the platform free for everyone. Their ads appear alongside activity listings, and they play a vital role in connecting families with quality local services while fostering community growth.', 'Supporters', 20.0::numeric, 'active') ,
  ('How do I become a Supporter?', 'Visit the Advertise page or click ''Ad Manager'' from the main navigation. You can check zip code availability, view current rates, and submit your ad for review. Supporter ads help fund the platform while promoting your business to engaged local families.', 'Supporters', 21.0::numeric, 'active') ,
  ('What are the advertising rates?', 'Visit the <a href="/supporters">Supporters page</a> for current rates.', 'Supporters', 23.0::numeric, 'active') ,
  ('Can I advertise in multiple zip codes?', 'Yes! You can purchase ad slots in as many zip codes as are available. Each zip code is sold separately, and you''ll manage each ad placement through your Ad Manager dashboard. Note that to keep inventory fair, each Supporter is limited to one active ad slot per zip code.', 'Supporters', 22.0::numeric, 'active') ,
  ('What happens if my area doesn''t have an ad slot available?', 'Join the waitlist for your desired zip code! When a slot opens up, waitlist members are notified in order of their position and given first chance to claim it. You can join the waitlist during the ad submission flow.', 'Supporters', 24.0::numeric, 'active') ,
  ('How do I contact the site administrators?', 'Use the Contact Us page to reach out with questions, suggestions, technical issues, or activity inquiries. All messages are reviewed by our admin team. You can also flag inappropriate content directly from activities and comments.', 'Accounts', 6.0::numeric, 'active') ,
  ('Is my personal information kept private?', 'Yes. We never sell or share your personal information. Contact details on activity postings are visible to help families connect, but your account email and private data are never shared with third parties. Please avoid posting personal information about children in public comments.', 'Accounts', 5.0::numeric, 'active') ,
  ('Can I post about private lessons or babysitting services?', 'No. Personal solicitation including babysitting, private tutoring, or one-on-one services is not allowed. The platform is for group activities, camps, classes, events, and sports leagues that benefit the broader community.', 'Activities', 14.0::numeric, 'active') ,
  ('How do I invite other families to join?', 'Share the site URL directly, use the share button on activity cards, or invite via the Contact page. The more families and organizers in your community, the more valuable the calendar becomes for everyone!', 'Activities', 18.0::numeric, 'active') ,
  ('How do I post an activity?', 'Click the ''Post Activity'' button in the main navigation (or from the homepage). You''ll need to be logged in with a registered account. Fill in the activity details including title, description, category, dates, location, and contact information. Community Members can post any activity, while Organizers get enhanced listings with logos and highlighted borders.', 'Activities', 12.0::numeric, 'active') ,
  ('How can I find activities in my area?', 'Use the search and filter tools on the homepage to narrow activities by category, age range, location, and dates. You can also set up notification preferences in your account to receive automated emails about new activities matching your interests and zip code.', 'Activities', 9.0::numeric, 'active') ,
  ('What are notification preferences and how do I set them up?', 'Notification preferences let you customize email updates about activities you care about. Go to your Account or Notifications page to set your preferred frequency (daily, weekly, monthly), select categories, specify age ranges, and choose your zip code with a radius. You''ll receive curated digests of new and upcoming activities that match your criteria.', 'Accounts', 2.0::numeric, 'active') ,
  ('Can I save activities to view later?', 'Yes! Click the bookmark/save icon on any activity card to add it to your saved list. Access your saved activities anytime from your Dashboard. This is great for comparing options or planning your schedule ahead.', 'Accounts', 4.0::numeric, 'active') ,
  ('How do I become an Organizer?', 'During registration, select ''Organizer'' as your account type (note: this choice is permanent). You''ll be able to represent your organization with a name, logo, and official contact information. Activities posted by Organizers get enhanced visibility with green borders and organizational branding.', 'Organizers', 8.0::numeric, 'active') ,
  ('What benefits do Organizers get?', 'Organizers can post official activities with their organization''s logo and branding, get highlighted placement on the homepage, build a follower base who receive notifications about their activities, and reach families beyond their existing email lists and social media circles.', 'Organizers', 7.0::numeric, 'active') ,
  ('Does the site use bots or aggregators to collect activity info?', 'Absolutely not! We feel that bots and aggregators that collect information for a site with this concept are not often aligned with the community needs ... focused on volume with filler rather than what parents are actually looking for. And using this method to collect information is really no more beneficial than typing in a search box and hoping the content you want is actually out there somewhere. LocalKidsCalendar.com focuses on bringing communities groups together by expanding the inner circles of teammates, classmates, playdate friends, and neighborhood families and extending the reach of group text and email chains, newsletters, and social media groups … things that bots and aggregators don’t have the same access to as our users. 
', 'Activities', 16.0::numeric, 'active') ,
  ('Why do I see advertisements, can I remove them?', 'Supporters (advertisers) are a key component of our community. The Supporters are the reason the site is free for everyone to use. And the Supporters are an integral part of fostering the growth of the community by helping bring together more local families and activity organizers, with a ROI incentive.', 'Supporters', 19.0::numeric, 'active') ,
  ('What''s the difference of an activity posted by a Community Member vs Organizer', 'Community Members (all users) can post an activity. This helps distribute useful information to the community without having to rely solely on organizations to do so. The information provided is only as reliable as the Community Member''s knowledge of it. But it''s surely better than nothing, and most times the information is accurate and beneficial. It''s often best when the Organizer posts an activity. Activities that are posted by the Organizer are highlighted with a green border on the homepage summaries and can include a photo and logo to make them stand out. TIP: Community Members should post activities when organizations are not, but encourage the organizations to get engaged and post them in the future. ', 'Activities', 11.0::numeric, 'active') ,
  ('Can I use the same user account as a Community Member and Organizer', 'Sorry, unfortunately not. To keep a better separation between the two, the Community Member accounts and Organizer accounts are separated and require different login credentials, including different emails (the email address is used as a unique account identifier). If you''re using the account personally and also wanting to post officially for an organization, it''s best to set up separate accounts with different email addresses for each. ', 'Accounts', 3.0::numeric, 'active') ,
  ('Do I have to pay to register for an account?', 'Nope! The site is free for users and contributors. Our Supporters (advertisers) help with the costs to keep everything running smoothly.', 'Accounts', 1.0::numeric, 'active') ,
  ('What happens if an activity I posted or comment I made is flagged by someone?', 'If something is flagged, the item that is flagged and the user who flagged it is reported to the Admin. Once an item is flagged by 3 different users, the item (post, comment, advertisement) is automatically removed from the site. ', 'Flagging', 25.0::numeric, 'active') ,
  ('Do I have to register for an account to use the site?', 'No. Anyone can browse the site for activity information and share information to social media. However, having an account offers a better experience with access to more features. Registered users can save activities and like organizations, create notifications to receive email updates for activities and organizations of their preference, and flag inappropriate and inaccurate information. User accounts are required to contact the site for questions, share ideas/suggestions, and report issues.', 'Accounts', 0.0::numeric, 'active') ,
  ('Is there a minimum number of users needed to make the site useful?', 'Not really. While the goal is to have many users and contributors from many sources and groups, the site still works well for micro communities. For example, if just youth hockey content is contributed, it''s useful for an audience interested in that topic even if there isn''t content for other topics. (In fact, this is usually how the seed starts growing in many communities!) But again, more the better. ', 'Activities', 15.0::numeric, 'active') ,
  ('What happens if I see activities or comments that do not meet Our Community Rules', 'The flagging system is designed as a community-moderation tool that allows authenticated users to report inappropriate or inaccurate content. Users can flag items by clicking the Flag icon (available on activity details and individual comments). If something receives 3 flags, it’s automatically removed from the site and submitted for review by the Admin. The Admin can/may manually remove activities and comments if it receives 1 flag.', 'Flagging', 26.0::numeric, 'active') ,
  ('Does Local Kids Calendar create or guarantee any of the activity information?', 'No. All of the activity information on the site is contributed by Community Members and Organizers. ', 'Activities', 17.0::numeric, 'active')
) as v(question, answer, category, sort_order, status)
where not exists (select 1 from public.faqs limit 1);
