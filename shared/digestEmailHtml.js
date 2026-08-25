const DEFAULT_APP_URL = "https://localkidscalendar.com";

const CATEGORY_LABELS = {
  camp: "Camps",
  childcare_enrichment: "Childcare & Enrichment",
  classes_lessons: "Classes & Lessons",
  community: "Community",
  events_experiences: "Events & Experiences",
  sports_teams: "Sports & Teams",
  class: "Classes & Lessons",
  event: "Events & Experiences",
  sport: "Sports & Teams",
  general_interest: "Community",
};

/** Sample events for admin email preview (Previews → Emails → Activity digest). */
export const DIGEST_SAMPLE_EVENTS = [
  {
    id: "preview-1",
    title: "Summer Soccer Camp",
    org_name: "Mountain Kids Soccer Club",
    start_date: "2026-07-15",
    city: "Las Vegas",
    state: "NV",
    age_min: 5,
    age_max: 12,
    cost: "75",
    category: "camp",
    event_image: "https://images.unsplash.com/photo-1566415074467-988b740b76d4?w=400",
  },
  {
    id: "preview-2",
    title: "Art & Crafts Workshop",
    org_name: "Little Stars Learning Center",
    start_date: "2026-07-18",
    city: "Henderson",
    state: "NV",
    age_min: 6,
    age_max: 10,
    cost: "25",
    category: "classes_lessons",
    event_image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400",
  },
  {
    id: "preview-3",
    title: "Youth Basketball League",
    org_name: "Happy Tots Daycare",
    start_date: "2026-07-22",
    city: "North Las Vegas",
    state: "NV",
    age_min: 7,
    age_max: 14,
    cost: "0",
    category: "sports_teams",
    event_image: "https://images.unsplash.com/photo-1546519638-68fa61938063?w=400",
  },
];

export const DIGEST_SAMPLE_ADS = [
  { image_url: "https://images.unsplash.com/photo-1560089000-7433a4ebbd64?w=600", link_url: "#" },
  { image_url: "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?w=600", link_url: "#" },
];

function categoryDisplay(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return "Activity";
  return list.map((c) => CATEGORY_LABELS[c] || c).join(", ");
}

function formatEventCard(event, appUrl) {
  const dateStr = event.start_date
    ? new Date(event.start_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
  const location = [event.city, event.state].filter(Boolean).join(", ");
  const cost = event.cost
    ? String(event.cost).startsWith("$")
      ? event.cost
      : `$${event.cost}`
    : "Free";
  const ages =
    event.age_min != null && event.age_max != null
      ? `Ages ${event.age_min}–${event.age_max}`
      : event.age_min != null
        ? `Ages ${event.age_min}+`
        : "";

  return `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:0;margin-bottom:16px;overflow:hidden;">
      ${event.event_image ? `<img src="${event.event_image}" alt="${event.title || "Activity"}" style="width:100%;max-height:160px;object-fit:cover;display:block;" />` : ""}
      <div style="padding:16px;">
        <span style="display:inline-block;background:#E0F7F2;color:#2D7A3E;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;">${categoryDisplay(event.category)}</span>
        <h3 style="margin:8px 0 4px;font-size:15px;font-weight:700;color:#1a2332;line-height:1.4;font-family:Quicksand,Nunito,Arial,sans-serif;">${event.title || "Activity"}</h3>
        ${event.org_name ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">by <strong style="color:#1a2332;">${event.org_name}</strong></p>` : ""}
        <div style="margin-bottom:12px;border-top:1px solid #f0f0f0;padding-top:8px;">
          ${dateStr ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">${dateStr}</div>` : ""}
          ${location ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">${location}</div>` : ""}
          ${ages ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">${ages}</div>` : ""}
          <div style="font-size:12px;color:#6b7280;">${cost}</div>
        </div>
        <a href="${appUrl}/event/${event.id}" style="display:inline-block;background:#2D7A3E;color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;font-family:Quicksand,Nunito,Arial,sans-serif;">View Details</a>
      </div>
    </div>
  `;
}

function formatAdsSection(ads, appUrl) {
  if (!ads?.length) return "";
  const cells = ads
    .slice(0, 3)
    .map(
      (ad) => `
    <td style="padding:0 4px;" valign="top" width="33%">
      <a href="${ad.link_url || appUrl}" style="display:block;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <img src="${ad.image_url}" alt="Supporter ad" style="width:100%;display:block;" />
      </a>
    </td>`
    )
    .join("");
  return `
    <div style="margin-top:8px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Supporters</p>
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>${cells}</tr></table>
    </div>`;
}

/**
 * Build the weekly activity digest email HTML (cron sends + admin preview).
 * @param {{ userName?: string, events: object[], frequency?: string, ads?: object[], unsubscribeUrl?: string, appUrl?: string }} opts
 */
export function buildDigestHtml({ userName, events, frequency, ads, unsubscribeUrl, appUrl = DEFAULT_APP_URL }) {
  const freqLabel = "Weekly";
  void frequency;
  const logoUrl = `${appUrl}/logo.png`;
  const eventCards = events.map((event) => formatEventCard(event, appUrl)).join("") + formatAdsSection(ads, appUrl);
  const unsub = unsubscribeUrl || `${appUrl}/account`;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Quicksand:wght@600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background:#f4f5f8;font-family:Nunito,Arial,sans-serif;color:#1a2332;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f5f8;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#2D7A3E;padding:24px 24px 22px;text-align:center;">
          <img src="${logoUrl}" alt="Local Kids Calendar" height="52" style="height:52px;width:auto;display:block;margin:0 auto 10px;border:0;" />
          <p style="margin:0;font-family:Quicksand,Nunito,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
            <span style="color:#fff;">LocalKids</span><span style="color:#C9E8D8;">Calendar</span>
          </p>
          <p style="margin:8px 0 0;color:#C9E8D8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;">${freqLabel} Activity Digest</p>
        </td></tr>
        <tr><td style="background:#fff;padding:24px;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:700;font-family:Quicksand,Nunito,Arial,sans-serif;color:#1a2332;">Hi ${userName || "there"}!</p>
          <p style="margin:0;font-size:14px;color:#5c6570;">We found ${events.length} activit${events.length === 1 ? "y" : "ies"} matching your interests.</p>
        </td></tr>
        <tr><td style="background:#fff;padding:20px 24px;">${eventCards}</td></tr>
        <tr><td style="background:#E0F7F2;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <a href="${appUrl}/account" style="display:inline-block;background:#fff;border:1px solid #C9E8D8;color:#2D7A3E;padding:8px 16px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;font-family:Quicksand,Nunito,Arial,sans-serif;">Manage Preferences</a>
        </td></tr>
        <tr><td style="background:#fff;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 8px;font-size:11px;color:#5c6570;">Community-powered kids' activities near you</p>
          <p style="margin:0;font-size:11px;color:#9ca3af;">
            <a href="${unsub}" style="color:#6b7280;text-decoration:underline;">Unsubscribe from weekly digests</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
