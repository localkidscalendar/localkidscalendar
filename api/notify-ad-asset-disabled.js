import {
  createAdminClient,
  requireUser,
  getEnv,
} from "./_lib/stripeHelpers.js";
import { sendViaResend } from "./_lib/resendSend.js";

const APP_URL = getEnv("APP_URL", "VITE_APP_URL") || "https://localkidscalendar.com";
const AD_MANAGER_URL = `${APP_URL.replace(/\/$/, "")}/ad-manager`;

function formatZipList(zipCodes) {
  const zips = [...new Set((zipCodes || []).filter(Boolean).map(String))];
  if (zips.length === 0) return "your area";
  if (zips.length === 1) return zips[0];
  if (zips.length === 2) return `${zips[0]} and ${zips[1]}`;
  return `${zips.slice(0, -1).join(", ")}, and ${zips[zips.length - 1]}`;
}

function buildCommunityDisableHtml({ businessName, zipCodes, reason }) {
  const zipLabel = formatZipList(zipCodes);
  const zipList =
    (zipCodes || []).length > 1
      ? `<ul>${(zipCodes || []).map((z) => `<li>Zip <strong>${z}</strong></li>`).join("")}</ul>`
      : "";
  return `
    <div style="font-family:sans-serif;color:#1a2332;line-height:1.6;padding:20px;">
      <h2 style="margin:0 0 12px;">Your ad creative was disabled</h2>
      <p>Hi ${businessName || "Supporter"},</p>
      <p>Your Supporter ad creative was flagged by the community and has been disabled across ${
        (zipCodes || []).length > 1 ? "these zip placements" : `zip code <strong>${zipLabel}</strong>`
      }.</p>
      ${zipList}
      <p><strong>Reason:</strong> ${reason || "Content flagged by 3+ community members"}</p>
      <p><strong>What Next:</strong> Your subscription and billing remain active. Open Ad Manager and assign a different approved creative to each affected zip to restore those placements. Each zip goes live again as soon as you assign a compliant Ad Asset.</p>
      <p><a href="${AD_MANAGER_URL}" style="display:inline-block;background:#2D7A3E;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Go to Ad Manager</a></p>
    </div>
  `;
}

/**
 * Authenticated endpoint: after a community 3-flag disables an Ad Asset,
 * send one consolidated email to the advertiser (idempotent via disable_notified_at).
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

    const bannerId = typeof req.body?.banner_id === "string" ? req.body.banner_id.trim() : "";
    if (!bannerId) return res.status(400).json({ error: "banner_id is required" });

    const admin = createAdminClient();

    const { data: banner, error: bannerError } = await admin
      .from("banner_ads")
      .select("id, user_id, business_name, zip_code, ad_library_id, image_url, link_url, status")
      .eq("id", bannerId)
      .maybeSingle();

    if (bannerError) throw bannerError;
    if (!banner) return res.status(404).json({ error: "Banner not found" });
    if (banner.status !== "flagged") {
      return res.status(409).json({ error: "Banner is not in a disabled/flagged state" });
    }

    // Resolve matching flagged assets for this creative
    let matched = [];
    if (banner.ad_library_id) {
      const { data } = await admin
        .from("ad_library")
        .select("id, moderation_status, disable_notified_at, deleted_at")
        .eq("id", banner.ad_library_id)
        .maybeSingle();
      if (data && !data.deleted_at) matched = [data];
    }
    if (!matched.length && banner.image_url && banner.link_url) {
      const { data: byUrls } = await admin
        .from("ad_library")
        .select("id, moderation_status, disable_notified_at, deleted_at")
        .eq("user_id", banner.user_id)
        .eq("image_url", banner.image_url)
        .eq("link_url", banner.link_url)
        .is("deleted_at", null);
      matched = byUrls || [];
    }

    const flaggedAssets = matched.filter((a) => a.moderation_status === "flagged");
    if (!flaggedAssets.length) {
      return res.status(409).json({ error: "No flagged ad asset found for this banner" });
    }

    if (flaggedAssets.every((a) => a.disable_notified_at)) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    // Collect all flagged zip placements using this creative
    let zipCodes = [];
    const assetIds = flaggedAssets.map((a) => a.id);
    const { data: related } = await admin
      .from("banner_ads")
      .select("zip_code, ad_library_id, image_url, link_url, status")
      .eq("user_id", banner.user_id)
      .eq("status", "flagged");

    zipCodes = [
      ...new Set(
        (related || [])
          .filter(
            (b) =>
              (b.ad_library_id && assetIds.includes(b.ad_library_id)) ||
              (banner.image_url &&
                banner.link_url &&
                b.image_url === banner.image_url &&
                b.link_url === banner.link_url)
          )
          .map((b) => b.zip_code)
          .filter(Boolean)
      ),
    ];
    if (!zipCodes.length && banner.zip_code) zipCodes = [banner.zip_code];

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("id", banner.user_id)
      .maybeSingle();

    if (!profile?.email) {
      return res.status(200).json({ ok: true, skipped: true, reason: "no_email" });
    }

    await sendViaResend({
      to: profile.email,
      subject: "Your ad creative was disabled",
      html: buildCommunityDisableHtml({
        businessName: banner.business_name || "Supporter",
        zipCodes,
        reason: "Ad creative flagged by 3+ community members and disabled across all zip placements.",
      }),
    });

    await admin.rpc("mark_ad_asset_disable_notified", { p_asset_ids: assetIds });

    // Caller auth is only needed to prevent anonymous spam; any signed-in user who
    // just completed submit_flag can trigger this once.
    void authUser;

    return res.status(200).json({ ok: true, zip_codes: zipCodes });
  } catch (error) {
    console.error("notify-ad-asset-disabled error:", error);
    return res.status(500).json({ error: error.message || "Failed to notify" });
  }
}
