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
