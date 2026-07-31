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
 */
export async function withdrawFlag(targetType, targetId) {
  const { data, error } = await supabase.rpc("withdraw_flag", {
    p_target_type: targetType,
    p_target_id: targetId,
  });
  return { data, error };
}
