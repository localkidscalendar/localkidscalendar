import { supabase } from "@/lib/supabaseClient";

/**
 * Look up the signed-in user's flag_reports row for a target.
 * Admin-cleared reports still exist (blocks re-flag) but cannot be withdrawn.
 */
export async function getUserFlagReport(targetType, targetId, userId) {
  if (!userId || !targetId || !targetType) {
    return { exists: false, adminCleared: false, canWithdraw: false };
  }
  const { data, error } = await supabase
    .from("flag_reports")
    .select("id, admin_action")
    .eq("reporter_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return { exists: false, adminCleared: false, canWithdraw: false };
  }
  const adminCleared = data.admin_action === "flag_cleared";
  return {
    exists: true,
    adminCleared,
    // Active or Admin-reactivated flags can be withdrawn; Admin-cleared cannot.
    canWithdraw: !adminCleared,
  };
}

/**
 * True if the signed-in user already submitted a flag for this target
 * (including Admin-cleared reports that still block re-flagging).
 */
export async function userHasFlaggedTarget(targetType, targetId, userId) {
  const status = await getUserFlagReport(targetType, targetId, userId);
  return status.exists;
}

export function alreadyFlaggedMessage(targetLabel = "item") {
  return `You already flagged this ${targetLabel}`;
}

export function adminClearedFlagMessage(targetLabel = "item") {
  return `An Admin already cleared your flag on this ${targetLabel}. You can't remove it or flag this ${targetLabel} again.`;
}

/**
 * Withdraw the signed-in user's flag for a target (deletes report + updates counters).
 * For user targets, prefer withdrawUserFlag(targetUserId); withdrawFlag("user", id) also works.
 * Rejects Admin-cleared reports (server-side).
 */
export async function withdrawFlag(targetType, targetId) {
  const { data, error } = await supabase.rpc("withdraw_flag", {
    p_target_type: targetType,
    p_target_id: targetId,
  });
  return { data, error };
}

/**
 * Submit a community flag against a user profile (details required for all reasons).
 * Reasons: misrepresented_user | disregard_rules | other
 */
export async function submitUserFlag(targetUserId, reason, details) {
  const { data, error } = await supabase.rpc("submit_user_flag", {
    p_target_user_id: targetUserId,
    p_reason: reason,
    p_details: details,
  });
  return { data, error };
}

/**
 * Withdraw the signed-in user's flag against a user profile.
 * Equivalent to withdrawFlag("user", targetUserId).
 */
export async function withdrawUserFlag(targetUserId) {
  const { data, error } = await supabase.rpc("withdraw_user_flag", {
    p_target_user_id: targetUserId,
  });
  return { data, error };
}
