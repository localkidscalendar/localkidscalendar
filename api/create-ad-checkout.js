import Stripe from "stripe";
import {
  getEnv,
  createAdminClient,
  requireUser,
  SLOT_HOLDING_STATUSES,
  computeAnnualPrice,
  getPricing,
  planDates,
} from "./_lib/stripeHelpers.js";
import { countOpenAdSlots } from "./_lib/waitlistQueue.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stripeSecret = getEnv("STRIPE_SECRET_KEY");
    if (!stripeSecret) {
      return res.status(500).json({ error: "Server missing STRIPE_SECRET_KEY" });
    }

    const { user: authUser, error: authError, status: authStatus } = await requireUser(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const admin = createAdminClient();

    const {
      plan_type: planType,
      zip_code: zipCodeRaw,
      business_name: businessName,
      link_url: linkUrl,
      image_url: imageUrl,
      ad_library_id: adLibraryId,
      discount_code: discountCode,
      waitlist_entry_id: waitlistEntryId,
      success_url: successUrlOverride,
      cancel_url: cancelUrlOverride,
    } = req.body || {};

    if (!planType || !["monthly", "annual"].includes(planType)) {
      return res.status(400).json({ error: "A valid plan_type (monthly or annual) is required" });
    }
    const zipCode = (zipCodeRaw || "").trim();
    if (!/^\d{5}$/.test(zipCode)) {
      return res.status(400).json({ error: "A valid 5-digit zip_code is required" });
    }
    if (!businessName || !linkUrl) {
      return res.status(400).json({ error: "business_name and link_url are required" });
    }
    if (!imageUrl && !adLibraryId) {
      return res.status(400).json({ error: "image_url or ad_library_id is required" });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", authUser.id)
      .maybeSingle();
    const isAdmin = profile?.role === "admin";
    const userEmail = (profile?.email || authUser.email || "").trim();

    // Slot availability + one-ad-per-user-per-zip
    const { data: existingAds } = await admin
      .from("banner_ads")
      .select("id, status, user_id")
      .eq("zip_code", zipCode);
    const holding = (existingAds || []).filter((ad) => SLOT_HOLDING_STATUSES.includes(ad.status));
    if (holding.some((ad) => ad.user_id === authUser.id)) {
      return res.status(409).json({ error: `You already have an ad for zip code ${zipCode}. Only one ad per zip code is allowed per Supporter.` });
    }

    // Only the rightful offered claimant may redeem a reserved waitlist slot.
    let ignoreWaitlistEntryId = null;
    if (waitlistEntryId) {
      const { data: wl } = await admin
        .from("ad_waitlist")
        .select("id, user_id, zip_code, status, offer_expires_date")
        .eq("id", waitlistEntryId)
        .maybeSingle();
      const offerOk =
        wl &&
        wl.user_id === authUser.id &&
        wl.zip_code === zipCode &&
        wl.status === "offered" &&
        wl.offer_expires_date &&
        new Date(wl.offer_expires_date) > new Date();
      if (offerOk) ignoreWaitlistEntryId = wl.id;
    }

    const slotInfo = await countOpenAdSlots(admin, zipCode, { ignoreWaitlistEntryId });
    if (slotInfo.open <= 0) {
      return res.status(409).json({
        error: `No slots available in zip code ${zipCode}. All ${slotInfo.maxSlots} spots are currently filled${slotInfo.reservedOffers ? " (including reserved waitlist offers)" : ""}.`,
      });
    }

    const { start: planStart, end: planEnd } = planDates(planType);

    // ── Admin bypass: skip Stripe, publish directly ──────────────────────
    if (isAdmin) {
      let resolvedImageUrl = imageUrl || null;
      let resolvedLinkUrl = linkUrl;
      if (adLibraryId) {
        const { data: libAd } = await admin
          .from("ad_library")
          .select("image_url, link_url, moderation_status")
          .eq("id", adLibraryId)
          .maybeSingle();
        if (libAd && libAd.moderation_status === "approved") {
          resolvedImageUrl = libAd.image_url;
          resolvedLinkUrl = libAd.link_url;
        }
      }

      const { data: ad, error: adError } = await admin
        .from("banner_ads")
        .insert({
          user_id: authUser.id,
          business_name: businessName,
          image_url: resolvedImageUrl,
          link_url: resolvedLinkUrl,
          zip_code: zipCode,
          plan_type: planType,
          status: "active",
          moderation_status: "auto_approved",
          plan_start_date: planStart,
          plan_end_date: planEnd,
          next_renewal_date: planEnd,
          rate_at_purchase: 0,
          tos_accepted: true,
          ad_library_id: adLibraryId || null,
          auto_renew: false,
          admin_override: true,
          notes: `Admin-created ad, no payment required. Created by ${userEmail || authUser.id}.`,
        })
        .select("id")
        .single();
      if (adError) throw adError;

      if (waitlistEntryId) {
        await admin.from("ad_waitlist").update({ status: "accepted" }).eq("id", waitlistEntryId).eq("user_id", authUser.id);
      }
      await admin.from("profiles").update({ is_advertiser: true }).eq("id", authUser.id);

      return res.status(200).json({ ad_id: ad.id, admin_bypass: true });
    }

    // ── Standard flow: Stripe Checkout ────────────────────────────────────
    const pricing = await getPricing(admin);
    const monthlyRate = Number(pricing.monthly_rate);
    const annualRate = computeAnnualPrice(monthlyRate, pricing.annual_discount_percent);
    const rateAtPurchase = planType === "annual" ? annualRate : monthlyRate;

    // Discount code validation
    let discountPercent = 0;
    let discountCodeId = null;
    if (discountCode) {
      const { data: dc } = await admin
        .from("discount_codes")
        .select("*")
        .eq("code", discountCode.trim().toUpperCase())
        .eq("status", "active")
        .maybeSingle();
      if (dc) {
        const today = new Date().toISOString().slice(0, 10);
        const notExpired = !dc.expires_date || dc.expires_date >= today;
        const planMatches = dc.plan_type === "both" || dc.plan_type === planType;
        const usesByUser = (dc.used_by_user_ids || []).filter((id) => id === authUser.id).length;
        const notMaxedForUser = usesByUser < Number(dc.max_uses_per_user || 1);
        const emailMatches = !dc.restricted_email || dc.restricted_email.toLowerCase() === userEmail.toLowerCase();
        if (notExpired && planMatches && notMaxedForUser && emailMatches) {
          discountPercent = Number(dc.discount_percent);
          discountCodeId = dc.id;
        }
      }
    }

    const { data: ad, error: adError } = await admin
      .from("banner_ads")
      .insert({
        user_id: authUser.id,
        business_name: businessName,
        image_url: imageUrl || null,
        link_url: linkUrl,
        zip_code: zipCode,
        plan_type: planType,
        status: "pending_payment",
        moderation_status: "needs_review",
        tos_accepted: true,
        auto_renew: true,
        ad_library_id: adLibraryId || null,
        discount_code_used: discountCode || null,
        discount_amount: discountPercent || null,
      })
      .select("id")
      .single();
    if (adError) throw adError;

    const stripe = new Stripe(stripeSecret);
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const successUrl = successUrlOverride || `${origin}/ad-manager?success=true&ad_id=${ad.id}`;
    const cancelUrl = cancelUrlOverride || `${origin}/ad-manager?cancelled=true`;

    const sessionParams = {
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: Math.round(rateAtPurchase * 100),
            recurring: { interval: planType === "annual" ? "year" : "month" },
            product_data: {
              name: `Local Kids Calendar Supporter Ad — Zip ${zipCode} (${planType === "annual" ? "Annual" : "Monthly"})`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ad_id: ad.id,
        user_id: authUser.id,
        zip_code: zipCode,
        plan_type: planType,
        discount_code_id: discountCodeId || "",
        ad_library_id: adLibraryId || "",
        waitlist_entry_id: waitlistEntryId || "",
        rate_at_purchase: String(rateAtPurchase),
      },
      subscription_data: {
        metadata: {
          ad_id: ad.id,
          user_id: authUser.id,
        },
      },
    };
    if (userEmail) sessionParams.customer_email = userEmail;

    if (discountPercent > 0) {
      const coupon = await stripe.coupons.create({ percent_off: discountPercent, duration: "once" });
      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeError) {
      // Release the reserved slot if Stripe checkout could not be created.
      await admin.from("banner_ads").delete().eq("id", ad.id);
      throw stripeError;
    }

    return res.status(200).json({ url: session.url, ad_id: ad.id });
  } catch (error) {
    console.error("create-ad-checkout error:", error);
    return res.status(500).json({ error: error.message || "Failed to start checkout" });
  }
}
