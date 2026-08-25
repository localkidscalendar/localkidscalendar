import moment from "moment";
import {
  MESSAGE_TYPE_BOXES,
  USER_FLAG_REASON_LABELS,
  CONTENT_FLAG_REASON_LABELS,
  KNOWN_MESSAGE_SUBJECTS,
  ADMIN_ACTION_LABEL,
} from "./adminPageConstants";

export function userFlagReasonLabel(reason) {
  return USER_FLAG_REASON_LABELS[reason] || (reason ? String(reason).replace(/_/g, " ") : "—");
}

export function contentFlagReasonLabel(reason) {
  return CONTENT_FLAG_REASON_LABELS[reason] || (reason ? String(reason).replace(/_/g, " ") : "—");
}

export function isMessageDeleted(m) {
  return Boolean(m.deleted_at);
}

export function isMessageAddressed(m) {
  return m.status === "resolved";
}

export function messagesForTypeBox(messages, box) {
  const active = messages.filter((m) => !isMessageDeleted(m));
  if (box.title === "General Questions") {
    return active.filter((m) => box.subjects.includes(m.subject) || !KNOWN_MESSAGE_SUBJECTS.has(m.subject));
  }
  return active.filter((m) => box.subjects.includes(m.subject));
}

export function unreadCountForTypeBox(messages, box) {
  return messagesForTypeBox(messages, box).filter((m) => m.status === "unread").length;
}

export function formatMessageSubmittedAt(createdDate) {
  const local = moment.utc(createdDate).local();
  return `${local.format("MMM D, YYYY h:mm A")} · ${local.fromNow()}`;
}

/** Status / reason for Admin → All Activities (matches My Posts inactive labels). */
export function getActivityStatusMeta(event) {
  const notes = String(event?.admin_notes || "").trim();
  const flags = Number(event?.flag_count || 0);

  if (event?.status === "active") {
    return {
      key: "active",
      label: "Active",
      reason: null,
      chipClass: "bg-mint-50 text-mint-600",
      adminNotes: null,
      canAdminRestore: false,
      isCommunityFlagged: false,
    };
  }

  if (event?.status === "archived" && flags >= 3) {
    return {
      key: "flagged",
      label: "Inactive",
      reason: "Community flags",
      chipClass: "bg-peach-50 text-peach-600",
      adminNotes: null,
      canAdminRestore: false,
      isCommunityFlagged: true,
    };
  }

  if (event?.status === "deleted" && notes) {
    return {
      key: "admin_removed",
      label: "Inactive",
      reason: "Admin removed",
      chipClass: "bg-red-50 text-red-600",
      adminNotes: notes,
      canAdminRestore: true,
      isCommunityFlagged: false,
    };
  }

  if (event?.status === "deleted") {
    return {
      key: "user_deactivated",
      label: "Inactive",
      reason: "User deactivated",
      chipClass: "bg-muted text-muted-foreground",
      adminNotes: null,
      canAdminRestore: false,
      isCommunityFlagged: false,
    };
  }

  if (event?.status === "archived") {
    return {
      key: "archived",
      label: "Inactive",
      reason: "Admin",
      chipClass: "bg-red-50 text-red-600",
      adminNotes: notes || null,
      canAdminRestore: false,
      isCommunityFlagged: false,
    };
  }

  return {
    key: event?.status || "unknown",
    label: event?.status || "Unknown",
    reason: null,
    chipClass: "bg-muted text-muted-foreground",
    adminNotes: notes || null,
    canAdminRestore: false,
    isCommunityFlagged: false,
  };
}

export function normalizeFlagCaseAction(action) {
  return String(action || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function isContentFlagCaseClosed(caseAction) {
  return ["reviewed", "flags_cleared", "manually_deactivated", "overridden"].includes(
    normalizeFlagCaseAction(caseAction)
  );
}

export function isUserFlagCaseClosed(caseAction) {
  return ["reviewed", "flags_cleared", "manually_deactivated", "manually_reinstated"].includes(
    normalizeFlagCaseAction(caseAction)
  );
}

export function getFlagHistory(report) {
  return Array.isArray(report?.admin_action_history) ? report.admin_action_history : [];
}

export function getDeactivatedCaseHistory(item) {
  return Array.isArray(item?.item?.flag_case_admin_history) ? item.item.flag_case_admin_history : [];
}

export function getUserFlagCaseHistory(profile) {
  return Array.isArray(profile?.user_flag_case_admin_history) ? profile.user_flag_case_admin_history : [];
}

export function isDeactivatedItemHidden(item) {
  return item.type === "ad"
    ? item.item.moderation_status === "flagged" || item.item.status === "flagged"
    : item.item.status === "archived";
}

export function isFlagOpen(f) {
  return !f.admin_action && !f.reviewed;
}

export function formatFlagSubmittedAt(createdDate) {
  const local = moment.utc(createdDate).local();
  return `${local.format("MMM D, YYYY h:mm A")} · ${local.fromNow()}`;
}

export function formatAdminHistoryEntry(entry) {
  const label = ADMIN_ACTION_LABEL[entry?.action] || entry?.action || "Action";
  const when = entry?.at ? formatFlagSubmittedAt(entry.at) : "";
  const by = entry?.by ? ` · ${entry.by}` : "";
  const sourceLabel =
    entry?.source === "flagged_users"
      ? " · via Flagged Users"
      : entry?.source === "users_list"
        ? " · via Users list"
        : entry?.scope === "account_disabled"
          ? " · account disable"
          : "";
  return `${label}${sourceLabel} — ${when}${by}`;
}

export function resolveReporterName(f, { users, organizerMap }) {
  const profile = users.find((u) => u.id === f.reporter_id);
  const fromProfile = profile
    ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim()
      || profile.full_name
      || ""
    : "";
  return (
    organizerMap[f.reporter_id]
    || fromProfile
    || f.reporter_name
    || profile?.email
    || "—"
  );
}

export function resolveDeactivatedContributor(item, { users, organizerMap }) {
  if (item.type === "event") {
    if (item.item.org_name) return item.item.org_name;
    if (item.item.created_by_id && organizerMap[item.item.created_by_id]) return organizerMap[item.item.created_by_id];
    const profile = users.find((u) => u.id === item.item.created_by_id);
    const fromProfile = profile
      ? [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() || profile.full_name || ""
      : "";
    return fromProfile || "—";
  }
  if (item.type === "comment") {
    return item.item.author_name || "—";
  }
  return item.item.ad_name || item.item.business_name || item.flags?.[0]?.target_contributor_name || "—";
}

export function resolveAdminDisplayName(adminId, users) {
  if (!adminId) return null;
  const adminProfile = users.find((u) => u.id === adminId);
  if (!adminProfile) return null;
  return (
    [adminProfile.first_name, adminProfile.last_name].filter(Boolean).join(" ").trim()
    || adminProfile.full_name
    || adminProfile.email
    || null
  );
}

export function describeDisableSource(profile) {
  const history = getUserFlagCaseHistory(profile);
  const lastDisable = [...history].reverse().find((e) => e?.action === "manually_deactivated");
  if (lastDisable?.source === "flagged_users") return "Admin → Flags → Flagged Users (Manual Disable)";
  if (lastDisable?.source === "users_list") return "Admin → Users → Disable";
  if (lastDisable?.scope === "account_disabled" || lastDisable?.action === "manually_deactivated") {
    return "Admin Disable (source not recorded)";
  }
  if (Number(profile?.user_flag_count || 0) >= 3 || profile?.suspended_at) {
    return "Likely after community user flags (3+)";
  }
  return "Admin Disable";
}

export function groupFlagsByTarget(list) {
  const map = new Map();
  for (const f of list) {
    if (!f.target_id) continue;
    if (!map.has(f.target_id)) map.set(f.target_id, []);
    map.get(f.target_id).push(f);
  }
  return Array.from(map.entries()).map(([targetId, group]) => ({
    targetId,
    flags: group.sort(
      (a, b) =>
        new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
    ),
  }));
}

export function formatAdZipLabel(item) {
  const zips = item?.zip_codes?.length
    ? item.zip_codes
    : (item?.zip_code ? [item.zip_code] : []);
  if (!zips.length) return null;
  return zips.length <= 2 ? zips.join(", ") : `${zips[0]} +${zips.length - 1}`;
}

export function flagsFiledByUserIncludingUsers(flags, userId) {
  return flags
    .filter((f) => f.reporter_id === userId)
    .sort(
      (a, b) =>
        new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
    );
}

export function flagsReceivedByUser(flags, userId) {
  return flags
    .filter((f) => f.target_type === "user" && f.target_id === userId)
    .sort(
      (a, b) =>
        new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
    );
}

export function flagsOnTarget(flags, targetType, targetId) {
  return flags
    .filter((f) => f.target_type === targetType && f.target_id === targetId)
    .sort(
      (a, b) =>
        new Date(b.created_at || b.created_date || 0) - new Date(a.created_at || a.created_date || 0)
    );
}
