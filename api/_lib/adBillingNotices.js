import { sendViaResend } from "./resendSend.js";

export const GRACE_PERIOD_DAYS = 7;
export const RENEWAL_REMINDER_DAYS = 21;

const APP_URL = process.env.VITE_APP_URL || "https://localkidscalendar.vercel.app";
const AD_MANAGER_URL = `${APP_URL}/ad-manager`;

function formatLongDate(date) {
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/Los_Angeles",
    });
  } catch {
    return String(date);
  }
}

async function createInboxMessage(admin, {
  userId,
  subject,
  body,
  templateKey,
  relatedType = "ad",
  relatedId = null,
  metadata = {},
}) {
  if (!userId || !subject || !body) return null;
  const { data, error } = await admin.rpc("create_user_message", {
    p_user_id: userId,
    p_subject: subject,
    p_body: body,
    p_template_key: templateKey,
    p_source: "system",
    p_action_label: "Open Ad Manager",
    p_action_href: "/ad-manager",
    p_related_type: relatedType,
    p_related_id: relatedId,
    p_mass_message_id: null,
    p_metadata: metadata,
  });
  if (error) throw error;
  return data;
}

export async function notifyPaymentFailed(admin, ad) {
  if (!ad?.user_id) return;
  const graceStart = ad.grace_period_start ? new Date(ad.grace_period_start) : new Date();
  const deadline = new Date(graceStart.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const deadlineLabel = formatLongDate(deadline);
  const zip = ad.zip_code || "your area";
  const business = ad.business_name || "Supporter";

  const subject = "Payment past due — action required";
  const body = [
    `Your Supporter ad renewal payment for zip ${zip} failed.`,
    `\n\nYour ad is temporarily hidden from public view, but your spot is still reserved for ${GRACE_PERIOD_DAYS} days (until ${deadlineLabel}).`,
    "\n\nUpdate your payment method in Ad Manager before that date. If payment isn’t updated in time, your spot will be released and may be offered to the waitlist.",
  ].join("");

  await createInboxMessage(admin, {
    userId: ad.user_id,
    subject,
    body,
    templateKey: "subscription_payment_failed",
    relatedId: ad.id,
    metadata: {
      channels: ["in_app", "email"],
      zip_code: ad.zip_code,
      grace_deadline: deadline.toISOString(),
    },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", ad.user_id)
    .maybeSingle();
  if (!profile?.email) return;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1a2332;padding:20px;">
      <h2 style="color:#2D7A3E;">Payment Past Due — Action Required</h2>
      <p>Hi ${business},</p>
      <p>Your Supporter ad renewal payment for zip code <strong>${zip}</strong> failed.</p>
      <div style="background:#FCEBDD;padding:14px 16px;border-radius:12px;margin:20px 0;border-left:4px solid #B36D25;">
        <p style="margin:0 0 8px;"><strong>What this means</strong></p>
        <ul style="margin:0;padding-left:18px;">
          <li>Your ad is temporarily hidden from public view</li>
          <li>Your zip spot is still reserved for <strong>${GRACE_PERIOD_DAYS} days</strong> (until <strong>${deadlineLabel}</strong>)</li>
          <li>If payment isn’t updated by then, your spot will be released and may be offered to the waitlist</li>
        </ul>
      </div>
      <p>Update your payment method in Ad Manager before the deadline to restore your ad.</p>
      <p><a href="${AD_MANAGER_URL}" style="display:inline-block;background:#2D7A3E;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700;">Open Ad Manager</a></p>
    </div>
  `;
  await sendViaResend({ to: profile.email, subject: "Payment Past Due — Action Required", html });
}

export async function notifySubscriptionRenewed(admin, ad) {
  if (!ad?.user_id) return;
  const zip = ad.zip_code || "your area";
  await createInboxMessage(admin, {
    userId: ad.user_id,
    subject: "Payment successful — ad renewed",
    body: `Your Supporter ad renewal payment for zip ${zip} was successful. Thank you for supporting local kids activities.`,
    templateKey: "subscription_renewed",
    relatedId: ad.id,
    metadata: { channels: ["in_app"], zip_code: ad.zip_code },
  });
}

export async function notifySubscriptionRenewingSoon(admin, ad) {
  if (!ad?.user_id || !ad.next_renewal_date) return;
  const zip = ad.zip_code || "your area";
  const renewalLabel = formatLongDate(ad.next_renewal_date);
  await createInboxMessage(admin, {
    userId: ad.user_id,
    subject: "Your Supporter ad is renewing soon",
    body: `Your Supporter ad for zip ${zip} renews on ${renewalLabel}. No action is needed unless you want to update payment or set non-renew in Ad Manager.`,
    templateKey: "subscription_renewing_soon",
    relatedId: ad.id,
    metadata: {
      channels: ["in_app"],
      zip_code: ad.zip_code,
      next_renewal_date: ad.next_renewal_date,
    },
  });
}

export async function notifyPlanUpgradeConfirmed(admin, ad, { renewalDate } = {}) {
  if (!ad?.user_id) return;
  const zip = ad.zip_code || "your area";
  const renewalLabel = formatLongDate(renewalDate || ad.next_renewal_date);
  await createInboxMessage(admin, {
    userId: ad.user_id,
    subject: "Your Supporter plan is switching to annual",
    body: [
      `As requested, your Supporter ad for zip ${zip} will switch from monthly to the annual plan at your upcoming renewal on ${renewalLabel}.`,
      "\n\nYour new annual rate is locked from the published pricing in effect about 21 days before renewal. That locked rate will be charged at renewal, and your plan will renew annually going forward unless you set non-renew.",
    ].join(""),
    templateKey: "plan_upgrade_confirmed",
    relatedId: ad.id,
    metadata: {
      channels: ["in_app"],
      zip_code: ad.zip_code,
      next_renewal_date: renewalDate || ad.next_renewal_date,
    },
  });
}

export async function notifyPlanDowngradeConfirmed(admin, ad, { renewalDate } = {}) {
  if (!ad?.user_id) return;
  const zip = ad.zip_code || "your area";
  const renewalLabel = formatLongDate(renewalDate || ad.next_renewal_date);
  await createInboxMessage(admin, {
    userId: ad.user_id,
    subject: "Your Supporter plan is switching to monthly",
    body: [
      `As requested, your Supporter ad for zip ${zip} will switch from annual to the monthly plan at your upcoming renewal on ${renewalLabel}.`,
      "\n\nYour new monthly rate is locked from the published pricing in effect about 21 days before renewal. That locked rate will be charged at renewal, and your plan will renew monthly going forward unless you set non-renew.",
    ].join(""),
    templateKey: "plan_downgrade_confirmed",
    relatedId: ad.id,
    metadata: {
      channels: ["in_app"],
      zip_code: ad.zip_code,
      next_renewal_date: renewalDate || ad.next_renewal_date,
    },
  });
}
