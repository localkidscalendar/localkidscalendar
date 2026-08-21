/**
 * Shared copy for Admin disable / reactivate prompts and user-facing notices.
 * Keep Admin dialogs, Account Disabled page, email, and inbox Message aligned.
 */

export const ACCOUNT_DISABLE_GENERAL_IMPACT = [
  "Registered features are blocked; you see this Account Disabled page when signed in.",
  "Weekly digests are turned Off.",
  "Active activities and comments are archived (removed from public view). People who saved your activities get a generic notice.",
];

export const ACCOUNT_DISABLE_SUPPORTER_IMPACT = [
  "Slot-holding ads (active, pending, past due, etc.) are cancelled and those zip slots are released so the waitlist can advance.",
  "Stripe subscriptions are set to cancel at period end — billing may continue through the current paid period, then stop renewing.",
  "Auto-renew is turned off on your ads.",
  "Ad waitlist entries for your account are cancelled.",
  "Your Supporter status may remain on the account, but cancelled placements and non-renewing Stripe are not undone by a later reactivation alone.",
];

export const ACCOUNT_REACTIVATE_GENERAL_IMPACT = [
  "Your prior role is restored so you can use Local Kids Calendar again.",
  "Weekly digests stay Off — turn them back on in Account → Notifications if you want them.",
  "Activities and comments archived by the disable are restored only if Admin chose those options when approving.",
];

export const ACCOUNT_REACTIVATE_SUPPORTER_IMPACT = [
  "Cancelled ads are not put back on the calendar automatically.",
  "Stripe renewals are not turned back on — subscriptions left as cancel-at-period-end stay that way unless billing is fixed separately.",
  "Waitlist spots are not restored; zip slots may already be held by others.",
  "To advertise again, use Ad Manager to claim or purchase slots and assign approved creatives (new Checkout if needed).",
];

export function formatImpactLines(lines) {
  return lines.map((line) => `• ${line}`).join("\n");
}

export function buildAccountReactivatedMessageBody({
  adminNote = null,
  isSupporter = false,
  restoredActivities = 0,
  restoredComments = 0,
} = {}) {
  const note = typeof adminNote === "string" ? adminNote.trim() : "";
  const restoreBits = [
    restoredActivities > 0
      ? `${restoredActivities} activit${restoredActivities === 1 ? "y" : "ies"}`
      : null,
    restoredComments > 0
      ? `${restoredComments} comment${restoredComments === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  const parts = [
    "An Admin reviewed your request and reactivated your account. You can use Local Kids Calendar again.",
    note ? `\nNote from Admin:\n${note}` : "",
    "",
    "What this means:",
    formatImpactLines(ACCOUNT_REACTIVATE_GENERAL_IMPACT),
  ];

  if (restoreBits.length) {
    parts.push("", `Admin also restored: ${restoreBits.join(" and ")}.`);
  } else {
    parts.push(
      "",
      "No archived activities or comments were restored with this approval (unless Admin did that separately)."
    );
  }

  if (isSupporter) {
    parts.push(
      "",
      "Ads, renewals, and waitlist (Supporter):",
      formatImpactLines(ACCOUNT_REACTIVATE_SUPPORTER_IMPACT)
    );
  } else {
    parts.push(
      "",
      "Ads and billing are not restored automatically if you had any."
    );
  }

  return parts.filter((p) => p !== null).join("\n");
}
