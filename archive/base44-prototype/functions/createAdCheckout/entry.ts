import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import Stripe from 'npm:stripe@14.5.0';

const MONTHLY_PRICE_ID = 'price_1Tn4v2K0ZBuK45DCjrDbRjrq';
const ANNUAL_PRICE_ID = 'price_1Tn4v2K0ZBuK45DCAUIDOxqf';

Deno.serve(async (req) => {
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
    const base44 = createClientFromRequest(req);

    // Auth required
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { plan_type, zip_code, business_name, link_url, image_url, ad_library_id, discount_code, waitlist_entry_id, success_url, cancel_url } = await req.json();

    if (!plan_type || !zip_code || !business_name || !link_url) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isAdmin = user.role === 'admin';

    // Verify slot availability
    const SLOT_HOLDING_STATUSES = ['active', 'pending_payment', 'pending_review', 'flagged', 'cancelled', 'expired', 'past_due'];
    const [zipConfigs, existingAds] = await Promise.all([
      base44.asServiceRole.entities.AdZipConfig.filter({ zip_code }),
      base44.asServiceRole.entities.BannerAd.filter({ zip_code }),
    ]);
    const maxSlots = zipConfigs.length > 0 ? zipConfigs[0].max_slots : 3;
    const slotsUsed = existingAds.filter((ad) => SLOT_HOLDING_STATUSES.includes(ad.status)).length;
    if (slotsUsed >= maxSlots) {
      return Response.json({ error: `No slots available in zip code ${zip_code}. All ${maxSlots} spots are currently filled.` }, { status: 409 });
    }

    // Prevent one Supporter from holding more than one slot in the same zip code
    const userAlreadyHoldsSlotInZip = existingAds.some(
      (ad) => ad.user_id === user.id && SLOT_HOLDING_STATUSES.includes(ad.status)
    );
    if (userAlreadyHoldsSlotInZip) {
      return Response.json({ error: `You already have an ad for zip code ${zip_code}. Only one ad per zip code is allowed per Supporter.` }, { status: 409 });
    }

    // ── Admin bypass: skip Stripe, publish directly ──────────────────────────
    if (isAdmin) {
      const now = new Date();
      const planStart = now.toISOString().split('T')[0];
      const planEnd = plan_type === 'annual'
        ? new Date(new Date(now).setFullYear(now.getFullYear() + 1)).toISOString().split('T')[0]
        : new Date(new Date(now).setMonth(now.getMonth() + 1)).toISOString().split('T')[0];

      // Resolve image/link from ad library if provided
      let resolvedImageUrl = image_url || null;
      let resolvedLinkUrl = link_url;
      if (ad_library_id) {
        try {
          const libAd = await base44.asServiceRole.entities.AdLibrary.get(ad_library_id);
          if (libAd && libAd.moderation_status === 'approved') {
            resolvedImageUrl = libAd.image_url;
            resolvedLinkUrl = libAd.link_url;
          }
        } catch (e) {
          console.error('Failed to load ad library item for admin bypass:', e.message);
        }
      }

      const ad = await base44.asServiceRole.entities.BannerAd.create({
        user_id: user.id,
        business_name,
        link_url: resolvedLinkUrl,
        image_url: resolvedImageUrl,
        zip_code,
        plan_type,
        status: 'active',
        moderation_status: 'auto_approved',
        plan_start_date: planStart,
        plan_end_date: planEnd,
        next_renewal_date: planEnd,
        rate_at_purchase: 0,
        tos_agreed: true,
        tos_agreed_date: now.toISOString(),
        flag_count: 0,
        flagged_by: [],
        impressions: 0,
        clicks: 0,
        auto_renew: false,
        admin_override: true,
        notes: `Admin-created ad, no payment required. Created by ${user.email}.`,
      });

      console.log(`Admin bypass: Ad ${ad.id} created and activated directly by ${user.email}`);
      return Response.json({ ad_id: ad.id, admin_bypass: true });
    }

    // ── Standard flow: Stripe checkout ──────────────────────────────────────

    // Check for discount code
    let discountPercent = 0;
    let discountCodeId = null;
    if (discount_code) {
      const codes = await base44.asServiceRole.entities.DiscountCode.filter({ code: discount_code.toUpperCase(), status: 'active' });
      const dc = codes[0];
      if (dc) {
        const now = new Date().toISOString().split('T')[0];
        const notExpired = !dc.expires_date || dc.expires_date >= now;
        const notMaxed = !dc.max_uses || (dc.times_used || 0) < dc.max_uses;
        const notUsedByUser = !(dc.used_by_user_ids || []).includes(user.id);
        const emailMatches = !dc.restricted_email || dc.restricted_email.toLowerCase() === (user.email || '').toLowerCase();
        if (notExpired && notMaxed && notUsedByUser && emailMatches) {
          discountPercent = dc.discount_percent;
          discountCodeId = dc.id;
        }
      }
    }

    const priceId = plan_type === 'annual' ? ANNUAL_PRICE_ID : MONTHLY_PRICE_ID;

    // Create a pending BannerAd record
    const ad = await base44.asServiceRole.entities.BannerAd.create({
      user_id: user.id,
      business_name,
      link_url,
      image_url: image_url || null,
      zip_code,
      plan_type,
      status: 'pending_payment',
      moderation_status: 'needs_review',
      tos_agreed: true,
      tos_agreed_date: new Date().toISOString(),
      flag_count: 0,
      flagged_by: [],
      impressions: 0,
      clicks: 0,
      auto_renew: true,
      discount_code_used: discount_code || null,
      discount_amount: discountPercent,
    });

    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url || `${req.headers.get('origin')}/ad-manager?success=true&ad_id=${ad.id}`,
      cancel_url: cancel_url || `${req.headers.get('origin')}/ad-manager?cancelled=true`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        ad_id: ad.id,
        user_id: user.id,
        zip_code,
        plan_type,
        discount_code_id: discountCodeId || '',
        ad_library_id: ad_library_id || '',
        waitlist_entry_id: waitlist_entry_id || '',
      },
      subscription_data: {
        metadata: {
          ad_id: ad.id,
          user_id: user.id,
        },
      },
    };

    if (discountPercent > 0) {
      const coupon = await stripe.coupons.create({ percent_off: discountPercent, duration: 'once' });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Created checkout session ${session.id} for ad ${ad.id}`);
    return Response.json({ url: session.url, ad_id: ad.id });
  } catch (error) {
    console.error('createAdCheckout error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});