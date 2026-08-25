export const PREVIEW_SECTIONS = [
  { id: "previews-emails", label: "Emails" },
  { id: "previews-automated", label: "Automated Messages" },
  { id: "previews-site-notices", label: "Site Notices" },
];

export const ADS_SECTIONS = [
  { id: "ads-supporter-ads", label: "Supporter Ads" },
  { id: "ads-zip-config", label: "Zip Config" },
  { id: "ads-waitlist", label: "Waitlist" },
  { id: "ads-rates", label: "Ad Rates" },
  { id: "ads-discounts", label: "Discounts" },
  { id: "ads-default-filler", label: "Default/Filler" },
];

export const REVIEW_SECTIONS = [
  { id: "review-activity", label: "Activity Manual Review" },
  { id: "review-advertising", label: "Advertising Manual Review" },
];

export const MESSAGE_TYPE_BOXES = [
  { id: "messages-technical", title: "Report Technical Issues", subjects: ["Report Technical Issues"] },
  { id: "messages-general", title: "General Questions", subjects: ["General Questions", "Inquire About Activity Details"] },
  { id: "messages-ideas", title: "Submit New Ideas & Suggestions", subjects: ["Submit New Ideas & Suggestions"] },
];

export const MESSAGE_SECTIONS = [
  { id: "messages-technical", label: "Report Technical Issues" },
  { id: "messages-general", label: "General Questions" },
  { id: "messages-ideas", label: "Submit New Ideas & Suggestions" },
  { id: "messages-deleted", label: "Deleted Messages" },
];

export const MASS_MESSAGE_SECTIONS = [
  { id: "mass-compose", label: "Compose Mass Message" },
  { id: "mass-archive", label: "Archived Mass Messages" },
  { id: "mass-digest", label: "Digest Notification" },
];

export const FLAGS_SECTIONS = [
  { id: "flags-flagged-content", label: "Flagged Content" },
  { id: "flags-flagged-users", label: "Flagged Users" },
  { id: "flags-users-flagging", label: "Top Flagging Activity Ranking" },
];

export const FLAGGED_USER_ROLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "community_member", label: "Community Members" },
  { id: "organizer", label: "Organizers" },
  { id: "3plus", label: "3+" },
];

export const ADMIN_ACTION_LABEL = {
  manually_deactivated: "Manually Deactivated",
  manually_reinstated: "Manually Reinstated",
  flag_cleared: "Flag Cleared",
  flags_cleared: "Flags Cleared",
  reviewed: "Reviewed",
  overridden: "Override 3+",
  reactivated: "Reactivated",
  flag_reactivated: "Flag Reactivated",
  unreviewed: "Marked Unreviewed",
};

export const REOPEN_FLAG_ACTIONS = new Set(["reactivated", "overridden", "flag_reactivated", "unreviewed"]);

export const USER_FLAG_REASON_LABELS = {
  misrepresented_user: "Misrepresented User",
  disregard_rules: "Disregard for Our Community Rules",
  other: "Other",
};

export const CONTENT_FLAG_REASON_LABELS = {
  inaccurate: "Inaccurate",
  inappropriate: "Inappropriate",
  spam: "Spam",
  other: "Other",
};

export const USER_SECTIONS = [
  { id: "users-list", label: "List of Users" },
  { id: "users-reactivation", label: "Reactivation Requests" },
  { id: "users-zip-reports", label: "Zip Code Reports" },
];

export const USER_LIST_FILTERS = [
  { id: "all", label: "All" },
  { id: "admin", label: "Admins" },
  { id: "community_member", label: "Community Members" },
  { id: "organizer", label: "Organizers" },
  { id: "supporter", label: "Supporters" },
];

export const FLAGGING_ACTIVITY_FILTERS = [
  { id: "all", label: "All" },
  { id: "flagging", label: "Flagging" },
  { id: "being_flagged", label: "Being Flagged" },
];

export const KNOWN_MESSAGE_SUBJECTS = new Set(MESSAGE_TYPE_BOXES.flatMap((box) => box.subjects));

export const REACTIVATE_RESTORE_OPTIONS = [
  {
    id: "activities",
    label: "Restore archived activities",
    hint: "Only items archived by this account disable (not 3+ content flags).",
    defaultChecked: false,
  },
  {
    id: "comments",
    label: "Restore archived comments",
    hint: "Only comments archived by this account disable.",
    defaultChecked: false,
  },
];
