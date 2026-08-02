-- Favorites are organizer-only. Remove any rows that target community-member posters
-- (e.g. from when Event Detail allowed favoriting any poster).
delete from public.favorite_organizers fo
using public.profiles p
where fo.poster_user_id = p.id
  and p.role = 'community_member';
