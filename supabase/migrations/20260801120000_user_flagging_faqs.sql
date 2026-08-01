-- Document account (user) flagging vs content flagging for public FAQs.

update public.faqs
set
  answer = 'The flagging system is a community-moderation tool for authenticated users. Flag activities and comments from the Flag icon (Inaccurate, Inappropriate, Spam, or Other with details). Flag ad creatives the same way, but for ads the reasons are Inappropriate, Spam, or Other — not Inaccurate — and the report targets the Ad Asset so flags accumulate across every zip using that creative. You can also flag a user (not their listing) from Posted by on an activity or from an Organizer card — Misrepresented User, Disregard for Our Community Rules, or Other, with details required. At 3 content flags, activities/comments are removed and ad creatives are disabled site-wide pending Admin review. At 3 user flags, the account is suspended for Admin review (guest actions only; they can still read My Messages). Admin may also manually remove content or disable an account.',
  updated_at = now()
where question = 'What happens if I see activities or comments that do not meet Our Community Rules';

update public.faqs
set
  answer = 'If something is flagged, the item and the user who flagged it are reported to Admin. Once an activity or comment is flagged by 3 different users, it is automatically removed from the site. For advertisements, flags attach to the Ad Asset (creative), not a single zip placement — reports from any zip count together. At 3 distinct flaggers, that creative is disabled everywhere it is running. Separately, if your account (user profile) is flagged by 3 different users, your account is suspended for Admin review: you can still sign in and read My Messages, but posting, commenting, flagging, saving, and similar actions are paused. Your public activities, comments, and running ads stay visible until an Admin decides otherwise.',
  updated_at = now()
where question = 'What happens if an activity I posted or comment I made is flagged by someone?';

update public.faqs
set
  answer = 'Use the Contact Us page to reach out with questions, suggestions, technical issues, or activity inquiries. All messages are reviewed by our admin team. You can also flag inappropriate content from activities, comments, and ad creatives, or flag a user from Posted by / Organizer cards when the concern is about the person rather than a single listing.',
  updated_at = now()
where question = 'How do I contact the site administrators?';

insert into public.faqs (question, answer, category, sort_order, status)
select
  v.question,
  v.answer,
  v.category,
  v.sort_order,
  v.status
from (
  values
    (
      'Can I flag a user, not just their activity or comment?',
      'Yes. From an activity’s Posted by area or an Organizer card, use Flag User when the concern is about the person (for example misrepresenting who they are, or disregard for Our Community Rules). This is separate from flagging a specific activity, comment, or ad creative. You must choose a reason and provide details. The prompt makes clear you are reporting the user, not the listing.',
      'Flagging',
      26.5::numeric,
      'active'
    ),
    (
      'What happens if my account is flagged by other users?',
      'Each community flag on your account is reviewed by Admin, and you receive an in-app message with the reason. At 3 distinct flaggers your account is suspended for Admin review: you can still sign in and read My Messages, but guest-only site actions apply (no posting, commenting, flagging, saving, or Ad Manager changes). Digests turn off. Your public activities, comments, organizer directory listing, and any running ads remain visible. If a reporter withdraws a flag or an Admin clears flags so you are below 3, suspension is lifted. Manual Disable by Admin is a separate, more severe path.',
      'Flagging',
      26.6::numeric,
      'active'
    )
) as v(question, answer, category, sort_order, status)
where not exists (
  select 1 from public.faqs f where f.question = v.question
);
