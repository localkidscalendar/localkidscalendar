/** Roles that may use registered-user features (post, account tabs, etc.). */
export const REGISTERED_ROLES = ["community_member", "organizer", "admin"];

export function isAccountDisabled(user) {
  return Boolean(user && user.role === "disabled");
}

/** Community 3+ user-flag freeze — not the same as Admin disable. */
export function isAccountSuspended(user) {
  return Boolean(user && user.role !== "disabled" && user.suspended_at);
}

export function isRegisteredUser(user) {
  if (!user || !REGISTERED_ROLES.includes(user.role)) return false;
  if (user.suspended_at) return false;
  return true;
}

/** Profile has finished signup (zip required). Admins / disabled skip this gate. */
export function isProfileComplete(user) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "disabled") return true;
  if (user.suspended_at) return true;
  return Boolean(String(user.zip_code || "").trim());
}

export function restoreRoleFromProfile(profileOrUser) {
  const prior = profileOrUser?.role_before_disabled;
  if (prior && REGISTERED_ROLES.includes(prior) && prior !== "admin") {
    return prior;
  }
  if (prior === "admin") return "admin";
  return "community_member";
}
