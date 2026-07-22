import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.5.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ad_id } = await req.json();
    if (!ad_id) return Response.json({ error: 'Missing ad_id' }, { status: 400 });

    // Fetch the ad and verify ownership
    const ad = await base44.asServiceRole.entities.BannerAd.get(ad_id);
    if (!ad) return Response.json({ error: 'Ad not found' }, { status: 404 });
    if (ad.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    if (!ad.stripe_subscription_id) {
      return Response.json({ error: 'No active subscription found for this ad.' }, { status: 400 });
    }

    // Tell Stripe to cancel at period end (not immediately)
    await stripe.subscriptions.update(ad.stripe_subscription_id, {
      cancel_at_period_end: true,
    });

    // Mark auto_renew false on our record
    await base44.asServiceRole.entities.BannerAd.update(ad_id, {
      auto_renew: false,
    });

    console.log(`cancelAdRenewal: Ad ${ad_id} set to cancel_at_period_end by user ${user.id}`);
    return Response.json({ success: true });
  } catch (error) {
    console.error('cancelAdRenewal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});