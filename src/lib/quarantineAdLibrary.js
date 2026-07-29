import { supabase } from "@/lib/supabaseClient";
import { buildEmail } from "@/lib/emailTemplates";
import { sendEmail } from "@/lib/sendEmail";
import { apiUrl } from "@/lib/apiBase";

/**
 * Disable the Ad Asset linked to a banner and cascade-flag all matching zip placements.
 * Returns the RPC payload (zip_codes, asset_ids, etc.).
 */
export async function disableAdAssetFromBanner(bannerId, reason = null) {
  if (!bannerId) return { data: null, error: new Error("Missing banner id") };
  const { data, error } = await supabase.rpc("disable_ad_asset_from_banner", {
    p_banner_id: bannerId,
    p_reason: reason || null,
  });
  return { data, error };
}

/** @deprecated Prefer disableAdAssetFromBanner — kept for older call sites. */
export async function quarantineAdLibraryForBanner(ad) {
  if (!ad?.id) return { error: null };
  const { error } = await disableAdAssetFromBanner(ad.id);
  return { error };
}

/**
 * Admin override: re-approve the asset and restore related flagged placements.
 */
export async function reactivateAdAssetFromBanner(bannerId) {
  if (!bannerId) return { data: null, error: new Error("Missing banner id") };
  const { data, error } = await supabase.rpc("reactivate_ad_asset_from_banner", {
    p_banner_id: bannerId,
  });
  return { data, error };
}

function formatZipList(zipCodes) {
  const zips = [...new Set((zipCodes || []).filter(Boolean).map(String))];
  if (zips.length === 0) return "";
  if (zips.length === 1) return zips[0];
  if (zips.length === 2) return `${zips[0]} and ${zips[1]}`;
  return `${zips.slice(0, -1).join(", ")}, and ${zips[zips.length - 1]}`;
}

/**
 * Send one consolidated email listing all affected zip placements.
 * Uses admin /api/send-email — call from Admin UI paths.
 */
export async function sendAdAssetDisabledEmail({
  userId,
  businessName,
  zipCodes,
  reason,
  templateKey = "ad_flagged_admin",
}) {
  if (!userId) return { sent: false };
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.email) return { sent: false };

    const zips = [...new Set((zipCodes || []).filter(Boolean).map(String))];
    const { subject, html } = buildEmail(templateKey, {
      business_name: businessName || "Supporter",
      zip_code: formatZipList(zips) || "your area",
      zip_codes: zips,
      reason: reason || "",
    });
    await sendEmail({ to: profile.email, subject, html });

    return { sent: true };
  } catch (err) {
    console.error("Failed to send ad asset disabled email", err);
    return { sent: false, error: err };
  }
}

/**
 * Community 3-flag path: server sends the consolidated notice (non-admin callers).
 */
export async function notifyAdAssetDisabled(bannerId) {
  if (!bannerId) return { ok: false };
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return { ok: false };

    const res = await fetch(apiUrl("/api/notify-ad-asset-disabled"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ banner_id: bannerId }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      console.error("notify-ad-asset-disabled failed", payload);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error("notify-ad-asset-disabled error", err);
    return { ok: false };
  }
}

/**
 * Soft-delete (flagged / has flag history) or hard-delete an Ad Library asset.
 */
export async function deleteAdLibraryAsset(assetId) {
  const { data, error } = await supabase.rpc("delete_ad_library_asset", {
    p_asset_id: assetId,
  });
  return { data, error };
}

export async function markAdAssetDisableNotified(assetIds) {
  const ids = (assetIds || []).filter(Boolean);
  if (!ids.length) return { error: null };
  const { error } = await supabase.rpc("mark_ad_asset_disable_notified", {
    p_asset_ids: ids,
  });
  return { error };
}
