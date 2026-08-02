import { toTitleCaseLabel } from "@/lib/titleCase";

const APP_URL = "https://localkidscalendar.com";

/** Site brand tokens mirrored for HTML emails (inline CSS only). */
const EMAIL_BRAND = {
  mint: "#2D7A3E",
  mintDark: "#1F5C2E",
  mintSoft: "#E0F7F2",
  mintMid: "#C9E8D8",
  peach: "#B36D25",
  peachSoft: "#FCEBDD",
  ink: "#1a2332",
  muted: "#5c6570",
  border: "#e5e7eb",
  pageBg: "#f4f5f8",
  white: "#ffffff",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  warn: "#B36D25",
  warnSoft: "#FCEBDD",
};

const EMAIL_FONT =
  "'Nunito', 'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
const EMAIL_HEADING_FONT =
  "'Quicksand', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

function emailCta(href, label) {
  const text = toTitleCaseLabel(label);
  return `<p style="margin:24px 0 8px;"><a href="${href}" style="display:inline-block;background:${EMAIL_BRAND.mint};color:#ffffff;padding:12px 18px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:700;font-family:${EMAIL_HEADING_FONT};">${text}</a></p>`;
}

function emailCallout(html, tone = "mint") {
  const map = {
    mint: { bg: EMAIL_BRAND.mintSoft, border: EMAIL_BRAND.mint },
    peach: { bg: EMAIL_BRAND.peachSoft, border: EMAIL_BRAND.peach },
    danger: { bg: EMAIL_BRAND.dangerSoft, border: EMAIL_BRAND.danger },
    warn: { bg: EMAIL_BRAND.warnSoft, border: EMAIL_BRAND.warn },
    muted: { bg: "#f3f4f6", border: EMAIL_BRAND.border },
  };
  const t = map[tone] || map.mint;
  return `<div style="background:${t.bg};padding:14px 16px;border-radius:12px;margin:20px 0;border-left:4px solid ${t.border};">${html}</div>`;
}

function wrapBrandedEmail(bodyHtml, { eyebrow = null } = {}) {
  if (/<!DOCTYPE html>/i.test(bodyHtml)) return bodyHtml;
  const logoUrl = `${APP_URL}/logo.png`;
  const eyebrowHtml = eyebrow
    ? `<p style="margin:8px 0 0;color:${EMAIL_BRAND.mintMid};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;font-family:${EMAIL_HEADING_FONT};">${eyebrow}</p>`
    : "";
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Quicksand:wght@600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:${EMAIL_BRAND.pageBg};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${EMAIL_BRAND.pageBg};padding:32px 16px;font-family:${EMAIL_FONT};color:${EMAIL_BRAND.ink};">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid ${EMAIL_BRAND.border};background:${EMAIL_BRAND.white};">
        <tr>
          <td style="background:${EMAIL_BRAND.mint};padding:24px 24px 22px;text-align:center;">
            <img src="${logoUrl}" alt="Local Kids Calendar" height="52" style="height:52px;width:auto;display:block;margin:0 auto 10px;border:0;" />
            <p style="margin:0;font-family:${EMAIL_HEADING_FONT};font-size:20px;font-weight:700;letter-spacing:-0.3px;line-height:1.2;">
              <span style="color:#ffffff;">LocalKids</span><span style="color:${EMAIL_BRAND.mintMid};">Calendar</span>
            </p>
            ${eyebrowHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px;font-size:15px;line-height:1.65;color:${EMAIL_BRAND.ink};font-family:${EMAIL_FONT};">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="background:${EMAIL_BRAND.mintSoft};padding:18px 24px;text-align:center;border-top:1px solid ${EMAIL_BRAND.border};">
            <p style="margin:0;font-size:12px;color:${EMAIL_BRAND.muted};line-height:1.5;font-family:${EMAIL_FONT};">
              Community-powered kids' activities near you.<br />
              <a href="${APP_URL}" style="color:${EMAIL_BRAND.mint};font-weight:700;text-decoration:none;">Visit LocalKidsCalendar</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Email-only categories (plus shared Automated Message categories where keys overlap). */
export const EMAIL_TEMPLATE_CATEGORIES = [
  { id: "digests", label: "Digests" },
  { id: "flags", label: "Flags" },
  { id: "admin_removals", label: "Admin Removals" },
  { id: "billing", label: "Billing" },
];

/**
 * Labels use Category · Target · Event. Where `value` matches an Automated Message key,
 * keep the same title as AUTOMATED_NOTICE_CATALOG so Emails and Messages stay correlated.
 */
export const EMAIL_TEMPLATE_META = [
  {
    value: "activity_digest",
    category: "digests",
    label: "Digests · Weekly Activity",
    audience: "Users with weekly digest notifications enabled",
    when: "Every Tuesday · includes Supporter ads for the recipient’s notification/profile zip (with default filler ads if slots are empty)",
  },
  {
    value: "ad_flagged_admin",
    category: "admin_removals",
    label: "Admin Removals · Ad Creative Disabled",
    audience: "Advertiser (Supporter)",
    when: "Admin disables an Ad Asset across all zip placements using it (Admin → Ads, or Flags → Manually Deactivate)",
  },
  {
    value: "ad_removed_flagged",
    category: "flags",
    label: "Flags · Ad Creative · Disabled (3+)",
    audience: "Advertiser (Supporter)",
    when: "An Ad Asset is disabled after 3 community flags (inbox notice includes reason; email also sent)",
  },
  {
    value: "subscription_payment_failed",
    category: "billing",
    label: "Billing · Payment Failed",
    audience: "Advertiser (Supporter)",
    when: "A renewal payment fails (7-day grace period starts)",
  },
  {
    value: "waitlist_spot_available",
    category: "billing",
    label: "Billing · Waitlist Spot Available",
    audience: "Waitlisted advertiser",
    when: "A zip code spot opens for someone on the waitlist",
  },
];

export const SAMPLE_DATA = {
  subscription_payment_failed: {
    business_name: "Summer Camp Adventures",
    zip_code: "89448",
    grace_deadline: "July 28, 2026",
    grace_days: "7",
  },
  waitlist_spot_available: {
    business_name: "Little Stars Learning Center",
    zip_code: "89448",
    expiry_date: "July 24, 2026, 3:00 PM Pacific",
    offer_count: 0,
    plan_type: "Monthly",
    rate: "150",
  },
  ad_removed_flagged: {
    business_name: "Kids Activity Zone",
    zip_code: "89448, 89449, and 89451",
    zip_codes: ["89448", "89449", "89451"],
    reason: "Ad creative flagged by 3+ community members and disabled across all zip placements.",
  },
  ad_flagged_admin: {
    business_name: "Kids Activity Zone",
    zip_code: "89448 and 89449",
    zip_codes: ["89448", "89449"],
    reason: "The destination link redirected to an unrelated third-party promotion.",
  },
  activity_digest: {
    ads: [
      { image_url: "https://images.unsplash.com/photo-1560089000-7433a4ebbd64?w=600", link_url: "#" },
      { image_url: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600", link_url: "#" },
    ],
    user_name: "Sarah",
    event1_title: "Summer Soccer Camp",
    event1_org: "Mountain Kids Soccer Club",
    event1_date: "July 15, 2026",
    event1_location: "Las Vegas, NV",
    event1_ages: "Ages 5–12",
    event1_cost: "$75",
    event2_title: "Art & Crafts Workshop",
    event2_org: "Little Stars Learning Center",
    event2_date: "July 18, 2026",
    event2_location: "Henderson, NV",
    event2_ages: "Ages 6–10",
    event2_cost: "$25",
    event3_title: "Youth Basketball League",
    event3_org: "Happy Tots Daycare",
    event3_date: "July 22, 2026",
    event3_location: "North Las Vegas, NV",
    event3_ages: "Ages 7–14",
    event3_cost: "Free",
  },
};

const SUBJECTS = {
  subscription_payment_failed: "Payment Past Due — Action Required",
  waitlist_spot_available: (data) => `A Spot Has Opened Up in ${data.zip_code || "your area"}!`,
  ad_removed_flagged: "Your ad creative was disabled",
  ad_flagged_admin: "Your ad creative was disabled",
  activity_digest: "Your Weekly Activity Digest",
};

function buildAdsHtml(data) {
  const adsList =
    data.ads && data.ads.length > 0
      ? data.ads
      : data.ad_image_url
        ? [{ image_url: data.ad_image_url, link_url: data.ad_link_url }]
        : [];
  if (adsList.length === 0) return "";
  return `
      <div style="margin-top:8px;margin-bottom:16px;">
        <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Supporters</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          ${adsList
            .map(
              (ad) => `
            <td style="padding:0 4px;" valign="top">
              <a href="${ad.link_url || "#"}" style="display:block;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
                <img src="${ad.image_url}" alt="Supporter ad" style="width:100%;display:block;" />
              </a>
            </td>
          `
            )
            .join("")}
        </tr></table>
      </div>
    `;
}

function buildHtml(templateKey, data) {
  const adsHtml = buildAdsHtml(data);
  const accountUrl = `${APP_URL}/account`;
  const adManagerUrl = `${APP_URL}/ad-manager`;
  const waitlistUrl = `${APP_URL}/ad-manager?tab=waitlist`;
  const h2 = (text) =>
    `<h2 style="margin:0 0 14px;font-family:${EMAIL_HEADING_FONT};font-size:20px;font-weight:700;color:${EMAIL_BRAND.mint};line-height:1.3;">${text}</h2>`;
  const p = (text) => `<p style="margin:0 0 12px;">${text}</p>`;

  const templates = {
    subscription_payment_failed: `
        ${h2("Payment Past Due — Action Required")}
        ${p(`Hi ${data.business_name || "Supporter"},`)}
        ${p(`Your Supporter ad renewal payment for zip code <strong>${data.zip_code || "your area"}</strong> failed.`)}
        ${emailCallout(`
            <p style="margin:0 0 8px;"><strong>What this means</strong></p>
            <ul style="margin:0;padding-left:18px;">
              <li>Your ad is temporarily hidden from public view</li>
              <li>Your zip spot is still reserved for <strong>${data.grace_days || "7"} days</strong> (until <strong>${data.grace_deadline || "the grace deadline"}</strong>)</li>
              <li>If payment isn’t updated by then, your spot will be released and may be offered to the waitlist</li>
            </ul>
          `, "peach")}
        ${p("Update your payment method in Ad Manager before the deadline to restore your ad.")}
        ${emailCta(adManagerUrl, "Open Ad Manager")}
      `,
    waitlist_spot_available: (() => {
      const zip = data.zip_code || "89448";
      const offerNum = Number(data.offer_count || 0) + 1;
      const attemptsLeft = Math.max(0, 3 - offerNum);
      const attemptsNote =
        attemptsLeft > 0
          ? `You have ${attemptsLeft} offer attempt${attemptsLeft !== 1 ? "s" : ""} remaining before your waitlist entry is cancelled.`
          : "This is your final offer — if not claimed, your waitlist entry will be cancelled.";
      return `
        ${h2(`A Spot Has Opened Up In ${zip}!`)}
        ${p(`Hi ${data.business_name || "Supporter"},`)}
        ${p(`Great news! A Supporter advertising spot has opened up in zip code <strong>${zip}</strong>.`)}
        ${p("You have <strong>24 hours</strong> to claim it. Here's what to do:")}
        <ol style="margin:0 0 12px;padding-left:18px;">
          <li>Log in to your account at Local Kids Calendar</li>
          <li>Go to <strong>Ad Manager</strong></li>
          <li>Open the <strong>Waitlist</strong> tab</li>
          <li>Find zip <strong>${zip}</strong> and click <strong>Subscribe Now</strong></li>
          <li>Complete checkout to lock in your spot</li>
        </ol>
        ${emailCallout(`<p style="margin:0;"><strong>Offer Expires:</strong> ${data.expiry_date || "MM/DD/YYYY"} Pacific Time</p>`, "peach")}
        ${emailCta(waitlistUrl, "Go To Ad Manager Waitlist")}
        ${p(`If you don't complete the process within 24 hours, your spot will be offered to the next person and you'll be moved to the back of the line. ${attemptsNote}`)}
        ${p("Thank you for supporting the local kids community!")}
        ${p("— The Local Kids Calendar Team")}
      `;
    })(),
    ad_removed_flagged: `
        ${h2("Your Ad Creative Was Disabled")}
        ${p(`Hi ${data.business_name || "Supporter"},`)}
        ${p(`Your Supporter ad creative was flagged by the community and has been disabled across ${(data.zip_codes || []).length > 1 ? "these zip placements" : `zip code <strong>${data.zip_code || "your area"}</strong>`}.`)}
        ${(data.zip_codes || []).length > 1 ? `<ul style="margin:0 0 12px;padding-left:18px;">${(data.zip_codes || []).map((z) => `<li>Zip <strong>${z}</strong></li>`).join("")}</ul>` : ""}
        ${emailCallout(`<p style="margin:0;"><strong>Reason:</strong> ${data.reason || "Content flagged by 3+ community members"}</p>`, "danger")}
        ${p("<strong>What Next:</strong> Your subscription and billing remain active. Open Ad Manager and assign a different approved creative to each affected zip to restore those placements. Each zip goes live again as soon as you assign a compliant Ad Asset.")}
        ${emailCta(adManagerUrl, "Open Ad Manager")}
      `,
    ad_flagged_admin: `
        ${h2("Your Ad Creative Was Disabled")}
        ${p(`Hi ${data.business_name || "Supporter"},`)}
        ${p(`Your Supporter ad creative has been disabled by our Admin team${(data.zip_codes || []).length > 1 || (data.zip_code || "").includes(",") ? " across these zip placements" : ` for zip code <strong>${data.zip_code || "your area"}</strong>`}.`)}
        ${(data.zip_codes || []).length > 1 ? `<ul style="margin:0 0 12px;padding-left:18px;">${(data.zip_codes || []).map((z) => `<li>Zip <strong>${z}</strong></li>`).join("")}</ul>` : (data.zip_code || "").includes(",") ? `<p style="margin:0 0 12px;"><strong>Affected Zips:</strong> ${data.zip_code}</p>` : ""}
        ${emailCallout(`<p style="margin:0;"><strong>Reason:</strong> ${data.reason || "Policy concern identified during review"}</p>`, "danger")}
        ${p("<strong>What Next:</strong> Your subscription and billing remain active. Open Ad Manager and assign a different approved creative to each affected zip to restore those placements. Each zip goes live again as soon as you assign a compliant Ad Asset.")}
        ${emailCta(adManagerUrl, "Open Ad Manager")}
      `,
    activity_digest: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Quicksand:wght@600;700&display=swap" rel="stylesheet" />
        </head>
        <body style="margin:0;padding:0;background:${EMAIL_BRAND.pageBg};font-family:${EMAIL_FONT};color:${EMAIL_BRAND.ink};">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${EMAIL_BRAND.pageBg};padding:32px 16px;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid ${EMAIL_BRAND.border};">
                <tr><td style="background:${EMAIL_BRAND.mint};padding:24px 24px 22px;text-align:center;">
                  <img src="${APP_URL}/logo.png" alt="Local Kids Calendar" height="52" style="height:52px;width:auto;display:block;margin:0 auto 10px;border:0;" />
                  <p style="margin:0;font-family:${EMAIL_HEADING_FONT};font-size:20px;font-weight:700;letter-spacing:-0.3px;">
                    <span style="color:#fff;">LocalKids</span><span style="color:${EMAIL_BRAND.mintMid};">Calendar</span>
                  </p>
                  <p style="margin:8px 0 0;color:${EMAIL_BRAND.mintMid};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">Weekly Activity Digest</p>
                </td></tr>
                <tr><td style="background:${EMAIL_BRAND.white};padding:24px;border-bottom:1px solid ${EMAIL_BRAND.border};">
                  <p style="margin:0 0 4px;font-size:16px;font-weight:700;font-family:${EMAIL_HEADING_FONT};color:${EMAIL_BRAND.ink};">Hi ${data.user_name || "there"}!</p>
                  <p style="margin:0;font-size:14px;color:${EMAIL_BRAND.muted};line-height:1.5;">We found 3 new activities matching your interests. Check them out:</p>
                </td></tr>
                <tr><td style="background:${EMAIL_BRAND.white};padding:20px 24px;">
                  <div style="background:${EMAIL_BRAND.white};border:1px solid ${EMAIL_BRAND.border};border-radius:12px;padding:0;margin-bottom:16px;overflow:hidden;">
                    <img src="https://images.unsplash.com/photo-1566415074467-988b740b76d4?w=400" alt="${data.event1_title || "Activity"}" style="width:100%;max-height:160px;object-fit:cover;display:block;" />
                    <div style="padding:16px;">
                      <span style="display:inline-block;background:${EMAIL_BRAND.mintSoft};color:${EMAIL_BRAND.mint};font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;margin-bottom:8px;">Camps</span>
                      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;font-family:${EMAIL_HEADING_FONT};color:${EMAIL_BRAND.ink};line-height:1.4;">${data.event1_title || "Summer Soccer Camp"}</h3>
                      <p style="margin:0 0 8px;font-size:12px;color:${EMAIL_BRAND.muted};">by <strong style="color:${EMAIL_BRAND.ink};">${data.event1_org || "Mountain Kids Soccer Club"}</strong></p>
                      <div style="margin-bottom:12px;border-top:1px solid #f0f0f0;padding-top:8px;">
                        <div style="margin:0 0 6px;font-size:12px;color:${EMAIL_BRAND.muted};">${data.event1_date || "July 15, 2026"}</div>
                        <div style="margin:0 0 6px;font-size:12px;color:${EMAIL_BRAND.muted};">${data.event1_location || "Las Vegas, NV"}</div>
                        <div style="margin:0 0 6px;font-size:12px;color:${EMAIL_BRAND.muted};">${data.event1_ages || "Ages 5–12"}</div>
                        <div style="font-size:12px;color:${EMAIL_BRAND.muted};">${data.event1_cost || "$75"}</div>
                      </div>
                      <a href="${APP_URL}" style="display:inline-block;background:${EMAIL_BRAND.mint};color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;font-family:${EMAIL_HEADING_FONT};">View Details</a>
                    </div>
                  </div>
                  <div style="background:${EMAIL_BRAND.white};border:1px solid ${EMAIL_BRAND.border};border-radius:12px;padding:0;margin-bottom:16px;overflow:hidden;">
                    <img src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400" alt="${data.event2_title || "Activity"}" style="width:100%;max-height:160px;object-fit:cover;display:block;" />
                    <div style="padding:16px;">
                      <span style="display:inline-block;background:${EMAIL_BRAND.mintSoft};color:${EMAIL_BRAND.mint};font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;margin-bottom:8px;">Classes &amp; Lessons</span>
                      <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;font-family:${EMAIL_HEADING_FONT};color:${EMAIL_BRAND.ink};line-height:1.4;">${data.event2_title || "Art & Crafts Workshop"}</h3>
                      <p style="margin:0 0 8px;font-size:12px;color:${EMAIL_BRAND.muted};">by <strong style="color:${EMAIL_BRAND.ink};">${data.event2_org || "Little Stars Learning Center"}</strong></p>
                      <div style="margin-bottom:12px;border-top:1px solid #f0f0f0;padding-top:8px;">
                        <div style="margin:0 0 6px;font-size:12px;color:${EMAIL_BRAND.muted};">${data.event2_date || "July 18, 2026"}</div>
                        <div style="margin:0 0 6px;font-size:12px;color:${EMAIL_BRAND.muted};">${data.event2_location || "Henderson, NV"}</div>
                        <div style="margin:0 0 6px;font-size:12px;color:${EMAIL_BRAND.muted};">${data.event2_ages || "Ages 6–10"}</div>
                        <div style="font-size:12px;color:${EMAIL_BRAND.muted};">${data.event2_cost || "$25"}</div>
                      </div>
                      <a href="${APP_URL}" style="display:inline-block;background:${EMAIL_BRAND.mint};color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;font-family:${EMAIL_HEADING_FONT};">View Details</a>
                    </div>
                  </div>
                  ${adsHtml}
                </td></tr>
                <tr><td style="background:${EMAIL_BRAND.mintSoft};padding:20px 24px;border-top:1px solid ${EMAIL_BRAND.border};text-align:center;">
                  <p style="margin:0 0 12px;font-size:12px;color:${EMAIL_BRAND.muted};">Want to tweak your interests?</p>
                  <a href="${accountUrl}" style="display:inline-block;background:${EMAIL_BRAND.white};border:1px solid ${EMAIL_BRAND.mintMid};color:${EMAIL_BRAND.mint};padding:8px 16px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;font-family:${EMAIL_HEADING_FONT};">Manage Preferences</a>
                </td></tr>
                <tr><td style="background:${EMAIL_BRAND.white};padding:16px 24px;text-align:center;border-top:1px solid ${EMAIL_BRAND.border};">
                  <p style="margin:0;font-size:11px;color:${EMAIL_BRAND.muted};">Community-powered kids' activities near you</p>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>
      `,
  };

  return templates[templateKey] || null;
}

/**
 * @param {string} templateKey
 * @param {Record<string, any>} [data]
 * @returns {{ subject: string, html: string }}
 */
export function buildEmail(templateKey, data = {}) {
  const raw = buildHtml(templateKey, data);
  if (!raw) {
    throw new Error(`Unknown email template: ${templateKey}`);
  }
  const html = wrapBrandedEmail(raw);
  const subjectEntry = SUBJECTS[templateKey];
  const subject = typeof subjectEntry === "function" ? subjectEntry(data) : subjectEntry || "Local Kids Calendar";
  return { subject, html };
}

export { APP_URL };
