-- Activate beta placements that were stuck in pending_review
-- (billing waived + creative already approved → should be live)

update public.banner_ads
set status = 'active',
    moderation_status = 'approved',
    updated_at = now()
where status = 'pending_review';
