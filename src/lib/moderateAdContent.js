import { supabase } from "@/lib/supabaseClient";

/**
 * Automated creative review via Supabase RPC (works in Safari; no Vercel /api).
 * Checks destination URL safety, then auto-approves. Community flagging covers image issues.
 */
export async function moderateAdContent(adLibraryId) {
  const { data, error } = await supabase.rpc("review_creative_asset", {
    p_asset_id: adLibraryId,
  });

  if (error) {
    throw new Error(error.message || "Automated review failed");
  }

  const status = data?.status;
  if (status !== "approved" && status !== "declined") {
    throw new Error("Review did not return an approve/decline result.");
  }

  return { status, reason: data?.reason || "" };
}
