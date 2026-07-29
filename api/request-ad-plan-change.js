import { createAdminClient, requireUser } from "./_lib/stripeHelpers.js";

/**
 * Schedule or cancel a monthly ↔ annual plan switch at next renewal.
 * Body: { ad_id, action: "request" | "cancel" }
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

    const { ad_id: adId, action } = req.body || {};
    if (!adId || !["request", "cancel"].includes(action)) {
      return res.status(400).json({ error: "Missing or invalid fields (ad_id, action)" });
    }

    const admin = createAdminClient();
    const { data: ad, error: adError } = await admin
      .from("banner_ads")
      .select(
        "id, user_id, status, plan_type, auto_renew, next_renewal_date, upgrade_to_annual_pending, downgrade_to_monthly_pending"
      )
      .eq("id", adId)
      .maybeSingle();
    if (adError) throw adError;
    if (!ad) return res.status(404).json({ error: "Ad not found" });
    if (ad.user_id !== authUser.id) return res.status(403).json({ error: "Forbidden" });

    if (action === "cancel") {
      const { error: cancelError } = await admin
        .from("banner_ads")
        .update({
          upgrade_to_annual_pending: false,
          upgrade_locked_annual_rate: null,
          upgrade_requested_date: null,
          downgrade_to_monthly_pending: false,
          downgrade_locked_monthly_rate: null,
          downgrade_requested_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adId);
      if (cancelError) throw cancelError;
      return res.status(200).json({ success: true, message: "Plan change request cancelled." });
    }

    if (!["active", "past_due"].includes(ad.status)) {
      return res.status(400).json({ error: "Ad must be active to schedule a plan change." });
    }
    if (ad.auto_renew === false) {
      return res.status(400).json({ error: "Turn auto-renew back on before scheduling a plan change." });
    }

    if (ad.plan_type === "monthly") {
      if (ad.upgrade_to_annual_pending) {
        return res.status(200).json({
          success: true,
          message: "Your ad is already scheduled to switch to annual at renewal.",
          already_pending: true,
        });
      }
      const { error: upError } = await admin
        .from("banner_ads")
        .update({
          upgrade_to_annual_pending: true,
          upgrade_requested_date: new Date().toISOString(),
          downgrade_to_monthly_pending: false,
          downgrade_locked_monthly_rate: null,
          downgrade_requested_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adId);
      if (upError) throw upError;
      return res.status(200).json({
        success: true,
        message: "Your ad will switch to the annual plan at your next renewal.",
      });
    }

    if (ad.plan_type === "annual") {
      if (ad.downgrade_to_monthly_pending) {
        return res.status(200).json({
          success: true,
          message: "Your ad is already scheduled to switch to monthly at renewal.",
          already_pending: true,
        });
      }
      const { error: downError } = await admin
        .from("banner_ads")
        .update({
          downgrade_to_monthly_pending: true,
          downgrade_requested_date: new Date().toISOString(),
          upgrade_to_annual_pending: false,
          upgrade_locked_annual_rate: null,
          upgrade_requested_date: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adId);
      if (downError) throw downError;
      return res.status(200).json({
        success: true,
        message: "Your ad will switch to the monthly plan at your next renewal.",
      });
    }

    return res.status(400).json({ error: "Unsupported plan type." });
  } catch (error) {
    console.error("request-ad-plan-change error:", error);
    return res.status(500).json({ error: error.message || "Failed to update plan change request" });
  }
}
