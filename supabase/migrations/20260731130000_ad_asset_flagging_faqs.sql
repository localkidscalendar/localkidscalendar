-- Clarify community flagging: ads attach to Ad Assets (creatives), not per-zip placements;
-- ad flag reasons omit Inaccurate.

update public.faqs
set
  answer = 'If something is flagged, the item and the user who flagged it are reported to Admin. Once an activity or comment is flagged by 3 different users, it is automatically removed from the site. For advertisements, flags attach to the Ad Asset (creative), not a single zip placement — reports from any zip count together. At 3 distinct flaggers, that creative is disabled everywhere it is running.',
  updated_at = now()
where question = 'What happens if an activity I posted or comment I made is flagged by someone?';

update public.faqs
set
  answer = 'The flagging system is a community-moderation tool for authenticated users. Flag activities and comments from the Flag icon (Inaccurate, Inappropriate, Spam, or Other with details). Flag ad creatives the same way, but for ads the reasons are Inappropriate, Spam, or Other — not Inaccurate — and the report targets the Ad Asset so flags accumulate across every zip using that creative. At 3 flags, activities/comments are removed and ad creatives are disabled site-wide pending Admin review. Admin may also manually remove content after a single flag.',
  updated_at = now()
where question = 'What happens if I see activities or comments that do not meet Our Community Rules';

update public.faqs
set
  answer = 'If a renewal payment fails, your ad is marked Past Due and you get a 7-day grace period to update your payment method before the ad is removed. If community members flag your Ad Asset (creative) 3+ times — counting reports from any zip where that creative runs — or an admin manually disables/rejects/pauses it, the creative is marked unavailable everywhere it is placed and you''ll always receive an email explaining the reason. Assign a different approved creative in Ad Manager to restore each affected zip.',
  updated_at = now()
where question = 'What happens if my ad payment fails or my ad is flagged?';

update public.faqs
set
  answer = 'Yes! Your Ad Library stores approved ad creatives (images and links) so you can reuse them the next time you buy or renew a zip code slot instead of re-uploading and waiting for re-approval every time. New or edited assets still go through a quick review before they can be used. Community flags attach to the asset (not each zip), and assets currently used by a live ad can''t be deleted.',
  updated_at = now()
where question = 'What is the Ad Library and can I reuse an ad design?';
