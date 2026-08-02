-- Idempotent: remove favorite_organizers rows that target community-member posters.
-- Favorites are organizer-only (Event Detail + Fav Organizers / digests).

delete from public.favorite_organizers fo
using public.profiles p
where fo.poster_user_id = p.id
  and p.role = 'community_member';
