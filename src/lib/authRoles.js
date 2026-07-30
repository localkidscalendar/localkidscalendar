/** Roles that may use registered-user features (post, account tabs, etc.). */
export const REGISTERED_ROLES = ["community_member", "organizer", "admin"];

export function isAccountDisabled(user) {
  return Boolean(user && user.role === "disabled");
}

export function isRegisteredUser(user) {
  return Boolean(user && REGISTERED_ROLES.includes(user.role));
}

/** Profile has finished signup (zip required). Admins / disabled skip this gate. */
export function isProfileComplete(user) {
  if (!user) return false;
  if (user.role === "admin" || user.role === "disabled") return true;
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
