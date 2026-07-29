import Stripe from "stripe";
import {
  createAdminClient,
  requireUser,
  getEnv,
  SLOT_HOLDING_STATUSES,
} from "./_lib/stripeHelpers.js";
import { runProcessWaitlist } from "./_lib/processWaitlistCore.js";

const ADMIN_EMAILS = new Set(["localkidscalendar@gmail.com"]);
const QUEUE_STATUSES = ["waiting", "offered"];

/**
 * Admin-only: disable a user account.
 * Always: role → disabled, digest notifications off.
 * If Supporter (is_advertiser): cancel slot-holding ads, Stripe non-renew,
 * release waitlist entries, then advance waitlists.
 *
 * Body: { user_id, note, prior_role? }
 */
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
    const { user: authUser, error: authError, status: authStatus } = await requireUser(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const admin = createAdminClient();
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", authUser.id)
      .maybeSingle();
    const callerEmail = (callerProfile?.email || authUser.email || "").trim().toLowerCase();
    if (callerProfile?.role !== "admin" && !ADMIN_EMAILS.has(callerEmail)) {
      return res.status(403).json({
        error: `Forbidden — admin role required (signed in as ${callerEmail || "unknown"}, role: ${callerProfile?.role || "none"})`,
      });
    }

    const userId = typeof req.body?.user_id === "string" ? req.body.user_id.trim() : "";
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
    if (!userId) return res.status(400).json({ error: "user_id is required" });
    if (!note) return res.status(400).json({ error: "note is required" });

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, role, role_before_disabled, is_advertiser")
      .eq("id", userId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) return res.status(404).json({ error: "User not found" });

    const requestedPrior =
      typeof req.body?.prior_role === "string" ? req.body.prior_role.trim() : "";
    const currentRole = target.role;
    const priorRole =
      requestedPrior && ["community_member", "organizer", "admin"].includes(requestedPrior)
        ? (requestedPrior === "admin" ? "community_member" : requestedPrior)
        : currentRole && currentRole !== "disabled" && ["community_member", "organizer", "admin"].includes(currentRole)
          ? (currentRole === "admin" ? "community_member" : currentRole)
          : (target.role_before_disabled || "community_member");

    const now = new Date().toISOString();
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: "disabled",
        role_before_disabled: priorRole,
        disabled_note: note,
        disabled_at: now,
        disabled_by: authUser.id,
        updated_at: now,
      })
      .eq("id", userId);
    if (profileError) throw profileError;

    // Turn off weekly digest (upsert so users without a prefs row are covered).
    const { error: digestError } = await admin
      .from("notification_preferences")
      .upsert(
        {
          user_id: userId,
          frequency: "none",
          updated_at: now,
        },
        { onConflict: "user_id" }
      );
    if (digestError) {
      console.error("admin-disable-user: digest prefs update failed:", digestError.message);
    }

    const isSupporter = Boolean(target.is_advertiser);
    const summary = {
      prior_role: priorRole,
      is_supporter: isSupporter,
      ads_cancelled: 0,
      stripe_non_renew: 0,
      waitlist_released: 0,
    };

    if (!isSupporter) {
      return res.status(200).json({ success: true, ...summary });
    }

    // Full disable for Supporters: inactive ads, Stripe non-renew, release waitlist.
    const { data: ads, error: adsError } = await admin
      .from("banner_ads")
      .select("id, status, stripe_subscription_id, auto_renew")
      .eq("user_id", userId);
    if (adsError) throw adsError;

    const stripeSecret = getEnv("STRIPE_SECRET_KEY");
    const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
    const holdingAds = (ads || []).filter((ad) => SLOT_HOLDING_STATUSES.includes(ad.status));
    const allAds = ads || [];

    for (const ad of allAds) {
      // Non-renew every ad that still has a Stripe subscription (or auto_renew on).
      if (ad.stripe_subscription_id && stripe) {
        try {
          await stripe.subscriptions.update(ad.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
          summary.stripe_non_renew += 1;
        } catch (err) {
          console.error(
            `admin-disable-user: Stripe non-renew failed for ad ${ad.id}:`,
            err.message
          );
        }
      }
    }

    if (holdingAds.length > 0) {
      const holdingIds = holdingAds.map((a) => a.id);
      const { error: cancelAdsError } = await admin
        .from("banner_ads")
        .update({
          status: "cancelled",
          auto_renew: false,
          cancelled_at: now,
          upgrade_to_annual_pending: false,
          upgrade_locked_annual_rate: null,
          upgrade_requested_date: null,
          downgrade_to_monthly_pending: false,
          downgrade_locked_monthly_rate: null,
          downgrade_requested_date: null,
          updated_at: now,
        })
        .in("id", holdingIds);
      if (cancelAdsError) throw cancelAdsError;
      summary.ads_cancelled = holdingIds.length;
    }

    // Mark remaining non-holding ads as non-renewing as well.
    const nonHoldingIds = allAds
      .filter((ad) => !SLOT_HOLDING_STATUSES.includes(ad.status) && ad.auto_renew !== false)
      .map((ad) => ad.id);
    if (nonHoldingIds.length > 0) {
      const { error: nonRenewError } = await admin
        .from("banner_ads")
        .update({ auto_renew: false, updated_at: now })
        .in("id", nonHoldingIds);
      if (nonRenewError) {
        console.error("admin-disable-user: auto_renew clear failed:", nonRenewError.message);
      }
    }

    const { data: waitlistRows, error: waitlistError } = await admin
      .from("ad_waitlist")
      .update({ status: "cancelled", updated_at: now })
      .eq("user_id", userId)
      .in("status", QUEUE_STATUSES)
      .select("id");
    if (waitlistError) throw waitlistError;
    summary.waitlist_released = (waitlistRows || []).length;

    try {
      const waitlistResult = await runProcessWaitlist(admin);
      console.log("admin-disable-user: processWaitlist after release:", waitlistResult);
    } catch (err) {
      console.error("admin-disable-user: processWaitlist failed:", err.message);
    }

    console.log(`admin-disable-user: disabled ${userId} by ${authUser.id}`, summary);
    return res.status(200).json({ success: true, ...summary });
  } catch (error) {
    console.error("admin-disable-user error:", error);
    return res.status(500).json({ error: error.message || "Failed to disable user" });
  }
}
