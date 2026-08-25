import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ad_id, ad_library_id } = await req.json();
    if (!ad_id || !ad_library_id) {
      return Response.json({ error: 'Missing ad_id or ad_library_id' }, { status: 400 });
    }

    const ad = await base44.asServiceRole.entities.BannerAd.get(ad_id);
    if (!ad) return Response.json({ error: 'Ad not found' }, { status: 404 });
    if (ad.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const asset = await base44.asServiceRole.entities.AdLibrary.get(ad_library_id);
    if (!asset) return Response.json({ error: 'Ad Library asset not found' }, { status: 404 });
    if (asset.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (asset.moderation_status !== 'approved') {
      return Response.json({ error: 'Only approved assets can be used.' }, { status: 400 });
    }

    const update = {
      business_name: asset.ad_name,
      image_url: asset.image_url,
      link_url: asset.link_url,
    };

    // Reactivate ads that were paused for a content reason while their subscription
    // remained valid (flagged, rejected, or admin-paused without a real Stripe cancellation).
    const canReactivate = ad.status === 'flagged' || ad.status === 'rejected' || (ad.status === 'cancelled' && !ad.cancelled_at);
    if (canReactivate) {
      update.status = 'active';
      update.moderation_status = 'approved';
      update.moderation_notes = '';
      update.replacement_required = false;
    }

    await base44.asServiceRole.entities.BannerAd.update(ad_id, update);

    console.log(`updateAdCreative: Ad ${ad_id} creative swapped to library asset ${ad_library_id} by user ${user.id}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('updateAdCreative error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});