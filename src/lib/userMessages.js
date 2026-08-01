import { supabase } from "@/lib/supabaseClient";
import { toTitleCaseLabel } from "@/lib/titleCase";

/**
 * Create an inbox message for a user (Admin only — uses RPC).
 */
export async function createUserMessage({
  userId,
  subject,
  body,
  templateKey = null,
  source = "system",
  actionLabel = null,
  actionHref = null,
  relatedType = null,
  relatedId = null,
  metadata = {},
}) {
  if (!userId || !subject || !body) {
    return { id: null, error: new Error("userId, subject, and body are required") };
  }
  const { data, error } = await supabase.rpc("admin_create_user_message", {
    p_user_id: userId,
    p_subject: subject,
    p_body: body,
    p_template_key: templateKey,
    p_source: source,
    p_action_label: actionLabel ? toTitleCaseLabel(actionLabel) : null,
    p_action_href: actionHref,
    p_related_type: relatedType,
    p_related_id: relatedId,
    p_metadata: metadata,
  });
  return { id: data || null, error };
}

export async function sendMassMessage({
  subject,
  body,
  audienceRoles = ["all"],
  audienceZips = [],
  actionLabel = null,
  actionHref = null,
}) {
  const { data, error } = await supabase.rpc("send_mass_message", {
    p_subject: subject,
    p_body: body,
    p_audience_roles: audienceRoles,
    p_audience_zips: audienceZips,
    p_action_label: actionLabel ? toTitleCaseLabel(actionLabel) : null,
    p_action_href: actionHref,
  });
  return { data, error };
}

export async function fetchUserMessages(userId, { includeDeleted = false } = {}) {
  let q = supabase
    .from("user_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!includeDeleted) q = q.is("deleted_at", null);
  return q;
}

export async function countUnreadMessages(userId) {
  const { count, error } = await supabase
    .from("user_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .is("read_at", null);
  return { count: count || 0, error };
}

export async function markMessageRead(messageId) {
  return supabase
    .from("user_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("id", messageId)
    .is("read_at", null);
}

export async function softDeleteMessage(messageId) {
  return supabase
    .from("user_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);
}

/** Admin: soft-delete all inbox copies of a mass message and remove it from the archive. */
export async function retractMassMessage(massMessageId) {
  const { data, error } = await supabase.rpc("retract_mass_message", {
    p_mass_message_id: massMessageId,
  });
  return { data, error };
}

/** Broadcast unread count so Navbar (and others) can refresh badges. */
export const UNREAD_MESSAGES_EVENT = "user-messages-unread";

export function publishUnreadMessagesCount(count) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(UNREAD_MESSAGES_EVENT, { detail: { count: Number(count) || 0 } })
  );
}

export async function notifySaversActivityRemoved(eventId, reason = null) {
  const { data, error } = await supabase.rpc("admin_notify_savers_activity_removed", {
    p_event_id: eventId,
    p_reason: reason,
  });
  return { data, error };
}

/** Convenience: activity removed by Admin → poster inbox (message only). */
export async function notifyActivityRemovedAdmin(event, reason) {
  if (!event?.created_by_id) return { error: null };
  return createUserMessage({
    userId: event.created_by_id,
    templateKey: "activity_removed_admin",
    source: "system",
    subject: "Your activity was removed",
    body: [
      `Your activity "${event.title || "your activity"}" was removed by our Admin team.`,
      reason ? `\nReason: ${reason}` : "",
      "\n\nYou can review this on My Activity Posts. If you believe this was a mistake, contact us.",
    ].join(""),
    actionLabel: "View My Activity Posts",
    actionHref: "/account?tab=posts",
    relatedType: "event",
    relatedId: event.id,
    metadata: { channels: ["in_app"], activity_title: event.title },
  });
}

/** Shared next-steps copy after an Ad Asset is disabled (admin or community). */
export const AD_CREATIVE_DISABLED_WHAT_NEXT =
  "What Next: Your subscription and billing remain active. Open Ad Manager and assign a different approved creative to each affected zip to restore those placements. Each zip goes live again as soon as you assign a compliant Ad Asset.";

/** Admin disabled an ad creative (cascade). */
export async function notifyAdCreativeDisabledAdmin({ userId, zipCodes = [], reason, businessName }) {
  if (!userId) return { error: null };
  const zips = [...new Set((zipCodes || []).filter(Boolean).map(String))];
  const zipLabel =
    zips.length === 0
      ? "your area"
      : zips.length === 1
        ? zips[0]
        : zips.length === 2
          ? `${zips[0]} and ${zips[1]}`
          : `${zips.slice(0, -1).join(", ")}, and ${zips[zips.length - 1]}`;
  return createUserMessage({
    userId,
    templateKey: "ad_flagged_admin",
    source: "system",
    subject: "Your ad creative was disabled",
    body: [
      `Hi ${businessName || "Supporter"},`,
      `\n\nYour Supporter ad creative has been disabled by our Admin team across ${zips.length > 1 ? "these zip placements" : `zip ${zipLabel}`}.`,
      zips.length > 1 ? `\nAffected zips: ${zips.join(", ")}` : "",
      reason ? `\n\nReason: ${reason}` : "",
      `\n\n${AD_CREATIVE_DISABLED_WHAT_NEXT}`,
    ].join(""),
    actionLabel: "Open Ad Manager",
    actionHref: "/ad-manager",
    relatedType: "ad",
    metadata: { channels: ["in_app", "email"], zip_codes: zips },
  });
}

export async function notifyActivityPhotoDecision(event, decision, reason = "") {
  if (!event?.created_by_id) return { error: null };
  const approved = decision === "approved";
  return createUserMessage({
    userId: event.created_by_id,
    templateKey: approved ? "activity_photo_approved_admin" : "activity_photo_declined_admin",
    source: "system",
    subject: approved ? "Your activity photo was approved" : "Your activity photo was declined",
    body: approved
      ? `The photo you uploaded for "${event.title || "your activity"}" has been manually reviewed and approved. It is now live on the listing.`
      : [
          `The photo you uploaded for "${event.title || "your activity"}" was not approved.`,
          reason ? `\n\nReason: ${reason}` : "",
          "\n\nPlease edit your activity to upload a different photo. Your activity remains live in the meantime.",
        ].join(""),
    actionLabel: "View My Activity Posts",
    actionHref: "/account?tab=posts",
    relatedType: "event",
    relatedId: event.id,
    metadata: { channels: ["in_app"] },
  });
}

/** Ad Library creative approved in Manual Review (message only). */
export async function notifyAdCreativeApprovedAdmin(asset) {
  if (!asset?.user_id) return { error: null };
  const name = asset.ad_name || "your creative";
  return createUserMessage({
    userId: asset.user_id,
    templateKey: "ad_creative_approved_admin",
    source: "system",
    subject: "Your ad creative was approved",
    body: `Your Supporter ad creative "${name}" has been manually reviewed and approved. It is now available to assign to zip placements in Ad Manager.`,
    actionLabel: "Open Ad Manager",
    actionHref: "/ad-manager",
    relatedType: "ad_library",
    relatedId: asset.id,
    metadata: { channels: ["in_app"], ad_name: name },
  });
}

/** Ad Library creative declined in Manual Review (message only). */
export async function notifyAdCreativeDeclinedAdmin(asset, reason = "") {
  if (!asset?.user_id) return { error: null };
  const name = asset.ad_name || "your creative";
  return createUserMessage({
    userId: asset.user_id,
    templateKey: "ad_creative_declined_admin",
    source: "system",
    subject: "Your ad creative was declined",
    body: [
      `Your Supporter ad creative "${name}" was not approved in manual review and has been removed from your library.`,
      reason ? `\n\nReason: ${reason}` : "",
      "\n\nPlease upload a new creative in Ad Library if you still want to advertise.",
    ].join(""),
    actionLabel: "Open Ad Manager",
    actionHref: "/ad-manager",
    relatedType: "ad_library",
    relatedId: asset.id,
    metadata: { channels: ["in_app"], ad_name: name },
  });
}

/** In-app notice when a user becomes a Supporter (self-serve or Admin grant). */
export async function notifyBecameSupporter(userId) {
  if (!userId) return { id: null, error: null };
  const { data, error } = await supabase.rpc("notify_became_supporter", {
    p_user_id: userId,
  });
  return { id: data || null, error };
}

/**
 * Admin: notify content owner after Flags actions.
 * p_event: "cleared" | "partial_cleared" | "reactivated" | "overridden"
 */
export async function notifyOwnerFlagLifecycle({
  userId,
  targetType,
  targetId,
  event,
  flagCount = 0,
  itemLabel = null,
}) {
  if (!userId || !targetType || !targetId || !event) {
    return { id: null, error: new Error("Missing notifyOwnerFlagLifecycle args") };
  }
  const { data, error } = await supabase.rpc("admin_notify_owner_flag_lifecycle", {
    p_owner_id: userId,
    p_target_type: targetType,
    p_target_id: targetId,
    p_event: event,
    p_flag_count: flagCount,
    p_reason: null,
    p_details: null,
    p_item_label: itemLabel,
  });
  return { id: data || null, error };
}
