import { sendViaResend } from "./resendSend.js";

const APP_URL = process.env.VITE_APP_URL || "https://localkidscalendar.vercel.app";

function formatEventCard(event) {
  const dateStr = event.start_date
    ? new Date(event.start_date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";
  const location = [event.city, event.state].filter(Boolean).join(", ");
  const cost = event.cost
    ? event.cost.startsWith("$")
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
        <span style="display:inline-block;background:#E0F7F2;color:#2D7A3E;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;text-transform:capitalize;">${event.category || "event"}</span>
        <h3 style="margin:8px 0 4px;font-size:15px;font-weight:700;color:#1a2332;line-height:1.4;">${event.title || "Activity"}</h3>
        ${event.org_name ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">by <strong style="color:#1a2332;">${event.org_name}</strong></p>` : ""}
        <div style="margin-bottom:12px;border-top:1px solid #f0f0f0;padding-top:8px;">
          ${dateStr ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">📅 ${dateStr}</div>` : ""}
          ${location ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">📍 ${location}</div>` : ""}
          ${ages ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">👥 ${ages}</div>` : ""}
          <div style="font-size:12px;color:#6b7280;">💰 ${cost}</div>
        </div>
        <a href="${APP_URL}/event/${event.id}" style="display:inline-block;background:#2D7A3E;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;">View Details</a>
      </div>
    </div>
  `;
}

function formatAdsSection(ads) {
  if (!ads?.length) return "";
  const cells = ads
    .slice(0, 3)
    .map(
      (ad) => `
    <td style="padding:0 4px;" valign="top">
      <a href="${ad.link_url || "#"}" style="display:block;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <img src="${ad.image_url}" alt="Supporter ad" style="width:100%;display:block;" />
      </a>
    </td>`
    )
    .join("");
  return `
    <div style="margin-top:8px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Supporters</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
    </div>`;
}

export function buildDigestHtml({ userName, events, frequency, ads }) {
  const freqLabel = "Weekly";
  void frequency;
  const eventCards = events.map(formatEventCard).join("") + formatAdsSection(ads);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f8f9fa;font-family:Arial,sans-serif;color:#374151;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#2D7A3E;padding:32px 24px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;">LocalKidsCalendar</h1>
          <p style="margin:8px 0 0;color:#C9E8D8;font-size:13px;text-transform:uppercase;">${freqLabel} Activity Digest</p>
        </td></tr>
        <tr><td style="background:#fff;padding:24px;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1a2332;">Hi ${userName || "there"}!</p>
          <p style="margin:0;font-size:13px;color:#6b7280;">We found ${events.length} activit${events.length === 1 ? "y" : "ies"} matching your interests.</p>
        </td></tr>
        <tr><td style="background:#fff;padding:20px 24px;">${eventCards}</td></tr>
        <tr><td style="background:#f9fafb;padding:20px 24px;text-align:center;border-top:1px solid #e5e7eb;">
          <a href="${APP_URL}/account" style="display:inline-block;background:#fff;border:1px solid #d1d5db;color:#2D7A3E;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;">Manage Preferences</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function eventMatchesPref(event, pref, favOrganizerUserIds) {
  if (pref.include_fav_organizers && favOrganizerUserIds?.includes(event.created_by_id)) {
    return true;
  }
  if (!pref.include_other_activities) {
    return false;
  }

  const locations = Array.isArray(pref.locations) ? pref.locations : [];
  const zipList = [
    ...locations.map((l) => l.zip_code).filter(Boolean),
    pref.zip_code,
  ].filter(Boolean);

  // Exact zip match for now (radius geocoding can be added later)
  if (zipList.length > 0 && event.zip_code && !zipList.includes(event.zip_code)) {
    return false;
  }
  if (zipList.length > 0 && !event.zip_code) return false;

  if (pref.keywords?.trim()) {
    const kws = pref.keywords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const haystack = `${event.title || ""} ${event.description || ""} ${event.keywords || ""}`.toLowerCase();
    if (!kws.some((kw) => haystack.includes(kw))) return false;
  }

  if (pref.age_min != null && event.age_max != null && Number(event.age_max) < Number(pref.age_min)) {
    return false;
  }
  if (pref.age_max != null && event.age_min != null && Number(event.age_min) > Number(pref.age_max)) {
    return false;
  }

  // If other activities is on but no criteria set, don't match everything
  const hasCriteria =
    zipList.length > 0 ||
    !!pref.keywords?.trim() ||
    pref.age_min != null ||
    pref.age_max != null;
  return hasCriteria;
}

async function loadUpcomingEvents(admin) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: events } = await admin
    .from("events")
    .select("*")
    .eq("status", "active")
    .gte("start_date", today.toISOString().slice(0, 10))
    .order("start_date", { ascending: true })
    .limit(50);
  return events || [];
}

async function loadActiveAds(admin) {
  const { data: ads } = await admin
    .from("banner_ads")
    .select("image_url, link_url")
    .eq("status", "active")
    .limit(3);
  return ads || [];
}

async function favPosterIdsForUser(admin, userId) {
  const { data: favs } = await admin
    .from("favorite_organizers")
    .select("poster_user_id")
    .eq("user_id", userId);
  return (favs || []).map((f) => f.poster_user_id).filter(Boolean);
}

/**
 * Admin preview: one digest to a single address (ignores prefs).
 */
export async function sendPreviewDigest(admin, { to, userName, frequency = "weekly" }) {
  const upcoming = await loadUpcomingEvents(admin);
  if (upcoming.length === 0) {
    return { ok: true, sent: 0, message: "No upcoming active events to include" };
  }
  const ads = await loadActiveAds(admin);
  const slice = upcoming.slice(0, 5);
  const html = buildDigestHtml({
    userName: userName || "there",
    events: slice,
    frequency,
    ads,
  });
  await sendViaResend({
    to,
    subject: `🌟 ${slice.length} kids' activities for you — Local Kids Calendar`,
    html,
  });
  return { ok: true, sent: 1, preview: true };
}

/**
 * Send digests to users whose notification_preferences.frequency is in `frequencies`.
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {{ frequencies: string[] }} opts
 */
export async function sendMatchingDigests(admin, { frequencies }) {
  const freqs = (frequencies || []).filter((f) => f && f !== "none");
  if (freqs.length === 0) {
    return { ok: true, sent: 0, message: "No frequencies selected" };
  }

  const upcoming = await loadUpcomingEvents(admin);
  if (upcoming.length === 0) {
    return { ok: true, sent: 0, message: "No upcoming active events to include", prefs_checked: 0 };
  }
  const ads = await loadActiveAds(admin);

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("*")
    .in("frequency", freqs);

  let sent = 0;
  const errors = [];

  for (const pref of prefs || []) {
    const { data: recipient } = await admin
      .from("profiles")
      .select("id, email, first_name, role")
      .eq("id", pref.user_id)
      .maybeSingle();
    if (!recipient?.email) continue;
    if (recipient.role === "admin" || recipient.role === "organizer") continue;

    let favIds = [];
    if (pref.include_fav_organizers) {
      favIds = await favPosterIdsForUser(admin, pref.user_id);
    }

    const matched = upcoming
      .filter((ev) => eventMatchesPref(ev, pref, favIds))
      .slice(0, 8);
    if (matched.length === 0) continue;

    try {
      const html = buildDigestHtml({
        userName: recipient.first_name || "there",
        events: matched,
        frequency: pref.frequency,
        ads,
      });
      await sendViaResend({
        to: recipient.email,
        subject: `🌟 ${matched.length} kids' activities for you — Local Kids Calendar`,
        html,
      });
      sent += 1;
    } catch (err) {
      errors.push({ email: recipient.email, error: err.message });
    }
  }

  return { ok: true, sent, errors, prefs_checked: (prefs || []).length };
}

/**
 * Cron schedule: weekly digests only, on Mondays (America/Los_Angeles).
 */
export function frequenciesForToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  return weekday === "Mon" ? ["weekly"] : [];
}
