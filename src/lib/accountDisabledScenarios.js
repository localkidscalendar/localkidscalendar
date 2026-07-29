/**
 * Shared Account Disabled preview scenarios (Admin Previews + full-page preview route).
 */
import moment from "moment";

export const ACCOUNT_DISABLED_SCENARIOS = [
  {
    id: "fresh",
    label: "Just Disabled (No Request)",
    disabledNote:
      "Your account was disabled due to repeated inappropriate flagging of community content. If you believe this was a mistake, you may submit a reactivation request.",
    disabledAt: moment().subtract(1, "hour").toISOString(),
    request: null,
  },
  {
    id: "pending",
    label: "Request Pending",
    disabledNote: "Account disabled for policy violations related to community guidelines.",
    disabledAt: moment().subtract(3, "days").toISOString(),
    request: {
      status: "pending",
      message: "I accidentally flagged several activities. I understand the guidelines now and would like my account restored.",
      created_at: moment().subtract(1, "day").toISOString(),
    },
  },
  {
    id: "declined",
    label: "Request Declined",
    disabledNote: "Account disabled for policy violations related to community guidelines.",
    disabledAt: moment().subtract(10, "days").toISOString(),
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
    label: "Request Reactivated",
    disabledNote: "Temporary disable for review.",
    disabledAt: moment().subtract(5, "days").toISOString(),
    request: {
      status: "reactivated",
      message: "Please restore access — this was a misunderstanding.",
      created_at: moment().subtract(4, "days").toISOString(),
      reviewed_at: moment().subtract(1, "day").toISOString(),
    },
  },
];
