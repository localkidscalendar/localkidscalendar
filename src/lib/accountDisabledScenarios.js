/**
 * Shared Account Disabled preview scenarios (Admin Previews + full-page preview route).
 * Preview titles use Category · Target · Event (aligned with Automated Messages / Emails).
 */
import moment from "moment";

export const SITE_NOTICE_CATEGORIES = [
  { id: "site", label: "Site" },
  { id: "account", label: "Account" },
];

export const ACCOUNT_DISABLED_SCENARIOS = [
  {
    id: "fresh",
    category: "account",
    label: "Just Disabled (No Request)",
    title: "Account · Disabled · Just Disabled (No Request)",
    disabledNote:
      "Your account was disabled due to repeated inappropriate flagging of community content. If you believe this was a mistake, you may submit a reactivation request.",
    disabledAt: moment().subtract(1, "hour").toISOString(),
    isSupporter: false,
    request: null,
  },
  {
    id: "fresh-supporter",
    category: "account",
    label: "Just Disabled — Supporter (Ads Impact)",
    title: "Account · Disabled · Just Disabled (Supporter)",
    disabledNote:
      "Your account was disabled after review of community reports. You may submit a reactivation request if you believe this was a mistake.",
    disabledAt: moment().subtract(2, "hours").toISOString(),
    isSupporter: true,
    request: null,
  },
  {
    id: "pending",
    category: "account",
    label: "Request Pending",
    title: "Account · Disabled · Request Pending",
    disabledNote: "Account disabled for policy violations related to community guidelines.",
    disabledAt: moment().subtract(3, "days").toISOString(),
    isSupporter: false,
    request: {
      status: "pending",
      message: "I accidentally flagged several activities. I understand the guidelines now and would like my account restored.",
      created_at: moment().subtract(1, "day").toISOString(),
    },
  },
  {
    id: "declined",
    category: "account",
    label: "Request Declined",
    title: "Account · Disabled · Request Declined",
    disabledNote: "Account disabled for policy violations related to community guidelines.",
    disabledAt: moment().subtract(10, "days").toISOString(),
    isSupporter: false,
    request: {
      status: "declined",
      message: "Please reactivate my account. I will follow the rules going forward.",
      created_at: moment().subtract(8, "days").toISOString(),
      admin_note:
        "After reviewing your flagging history, we are unable to reactivate your account at this time.",
      reviewed_at: moment().subtract(7, "days").toISOString(),
    },
  },
  {
    id: "reactivated",
    category: "account",
    label: "Request Reactivated",
    title: "Account · Disabled · Request Reactivated",
    disabledNote: "Temporary disable for review.",
    disabledAt: moment().subtract(5, "days").toISOString(),
    isSupporter: true,
    request: {
      status: "reactivated",
      message: "Please restore access — this was a misunderstanding.",
      created_at: moment().subtract(4, "days").toISOString(),
      reviewed_at: moment().subtract(1, "day").toISOString(),
    },
  },
];
