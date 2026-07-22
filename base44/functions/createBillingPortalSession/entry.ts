import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.5.0';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { ad_id, return_url } = await req.json();
    if (!ad_id) return Response.json({ error: 'Missing ad_id' }, { status: 400 });

    const ad = await base44.asServiceRole.entities.BannerAd.get(ad_id);
    if (!ad) return Response.json({ error: 'Ad not found' }, { status: 404 });
    if (ad.user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (!ad.stripe_customer_id) {
      return Response.json({ error: 'No billing account found for this ad.' }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: ad.stripe_customer_id,
      return_url: return_url || `${req.headers.get('origin')}/ad-manager`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('createBillingPortalSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});