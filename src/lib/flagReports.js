import { supabase } from "@/lib/supabaseClient";

/**
 * True if the signed-in user already submitted a flag for this target.
 * Uses flag_reports (RLS: users read their own rows).
 */
export async function userHasFlaggedTarget(targetType, targetId, userId) {
  if (!userId || !targetId || !targetType) return false;
  const { data, error } = await supabase
    .from("flag_reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export function alreadyFlaggedMessage(targetLabel = "item") {
  return `You already flagged this ${targetLabel}`;
}

/**
 * Withdraw the signed-in user's flag for a target (deletes report + updates counters).
 * For user targets, prefer withdrawUserFlag(targetUserId); withdrawFlag("user", id) also works.
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
