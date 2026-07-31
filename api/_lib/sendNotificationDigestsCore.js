import { sendViaResend } from "./resendSend.js";
import { pickDefaultFillerAds } from "../../shared/pickDefaultFillerAds.js";
import {
  alreadySentDigestThisWeek,
  digestUnsubscribeApiUrl,
  digestUnsubscribeUrl,
  isEmailSendingEnabled,
  isEmailSuppressed,
  loadEmailConfig,
  sleep,
} from "./emailGuards.js";

const APP_URL = process.env.VITE_APP_URL || "https://localkidscalendar.com";
const LOGO_URL = `${APP_URL}/logo.png`;
const SEND_DELAY_MS = 50;

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

function categoryDisplay(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return "Activity";
  return list.map((c) => CATEGORY_LABELS[c] || c).join(", ");
}

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
        <span style="display:inline-block;background:#E0F7F2;color:#2D7A3E;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;">${categoryDisplay(event.category)}</span>
        <h3 style="margin:8px 0 4px;font-size:15px;font-weight:700;color:#1a2332;line-height:1.4;font-family:Quicksand,Nunito,Arial,sans-serif;">${event.title || "Activity"}</h3>
        ${event.org_name ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">by <strong style="color:#1a2332;">${event.org_name}</strong></p>` : ""}
        <div style="margin-bottom:12px;border-top:1px solid #f0f0f0;padding-top:8px;">
          ${dateStr ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">${dateStr}</div>` : ""}
          ${location ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">${location}</div>` : ""}
          ${ages ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">${ages}</div>` : ""}
          <div style="font-size:12px;color:#6b7280;">${cost}</div>
        </div>
        <a href="${APP_URL}/event/${event.id}" style="display:inline-block;background:#2D7A3E;color:#fff;padding:8px 14px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;font-family:Quicksand,Nunito,Arial,sans-serif;">View Details</a>
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
    <td style="padding:0 4px;" valign="top" width="33%">
      <a href="${ad.link_url || APP_URL}" style="display:block;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
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

export function buildDigestHtml({ userName, events, frequency, ads, unsubscribeUrl }) {
  const freqLabel = "Weekly";
  void frequency;
  const eventCards = events.map(formatEventCard).join("") + formatAdsSection(ads);
  const unsub = unsubscribeUrl || `${APP_URL}/account`;
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
          <img src="${LOGO_URL}" alt="Local Kids Calendar" height="52" style="height:52px;width:auto;display:block;margin:0 auto 10px;border:0;" />
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
          <a href="${APP_URL}/account" style="display:inline-block;background:#fff;border:1px solid #C9E8D8;color:#2D7A3E;padding:8px 16px;border-radius:10px;text-decoration:none;font-size:12px;font-weight:700;font-family:Quicksand,Nunito,Arial,sans-serif;">Manage Preferences</a>
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

function zipForDigest(pref, profileZip) {
  const locations = Array.isArray(pref?.locations) ? pref.locations : [];
  return (
    locations.map((l) => l?.zip_code).find(Boolean) ||
    pref?.zip_code ||
    profileZip ||
    null
  );
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

/**
 * Load supporter ads for a zip the same way the site does:
 * active banner_ads for that zip, then default/filler ads for empty slots.
 */
async function loadAdsForZip(admin, zipCode) {
  let maxSlots = 3;
  if (zipCode) {
    const { data: zipConfig } = await admin
      .from("ad_zip_config")
      .select("max_slots")
      .eq("zip_code", zipCode)
      .maybeSingle();
    if (zipConfig?.max_slots) maxSlots = Number(zipConfig.max_slots) || 3;
  }

  let paidAds = [];
  if (zipCode) {
    const { data } = await admin
      .from("banner_ads")
      .select("image_url, link_url")
      .eq("status", "active")
      .eq("zip_code", zipCode)
      .order("created_at", { ascending: false })
      .limit(maxSlots);
    paidAds = (data || []).filter((a) => a.image_url);
  }

  const emptySlots = Math.max(0, maxSlots - paidAds.length);
  let fillers = [];
  if (emptySlots > 0) {
    const { data: defaults } = await admin
      .from("admin_default_ads")
      .select("*")
      .eq("status", "active")
      .order("priority", { ascending: false })
      .limit(10);
    fillers = pickDefaultFillerAds(defaults || [], emptySlots)
      .filter((a) => a.image_url)
      .map((a) => ({
        image_url: a.image_url,
        link_url: a.link_url || APP_URL,
      }));
  }

  return [...paidAds, ...fillers].slice(0, maxSlots);
}

async function favPosterIdsForUser(admin, userId) {
  const { data: favs } = await admin
    .from("favorite_organizers")
    .select("poster_user_id")
    .eq("user_id", userId);
  return (favs || []).map((f) => f.poster_user_id).filter(Boolean);
}

async function turnOffDigest(admin, userId) {
  await admin
    .from("notification_preferences")
    .update({ frequency: "none", updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

/**
 * Admin preview: one digest to a single address (ignores prefs).
 */
export async function sendPreviewDigest(admin, { to, userName, frequency = "weekly", zipCode = null }) {
  if (!isEmailSendingEnabled()) {
    return { ok: true, sent: 0, skipped: true, reason: "EMAIL_SENDING_ENABLED" };
  }
  const upcoming = await loadUpcomingEvents(admin);
  if (upcoming.length === 0) {
    return { ok: true, sent: 0, message: "No upcoming active events to include" };
  }
  const zip = zipCode || upcoming.find((e) => e.zip_code)?.zip_code || null;
  const ads = await loadAdsForZip(admin, zip);
  const slice = upcoming.slice(0, 5);
  const html = buildDigestHtml({
    userName: userName || "there",
    events: slice,
    frequency,
    ads,
    unsubscribeUrl: `${APP_URL}/account`,
  });
  const result = await sendViaResend({
    to,
    subject: `🌟 ${slice.length} kids' activities for you — Local Kids Calendar`,
    html,
  });
  if (result.skipped) {
    return { ok: true, sent: 0, skipped: true, reason: result.reason, preview: true };
  }
  return { ok: true, sent: 1, preview: true, zip_code: zip, ads_included: ads.length };
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

  if (!isEmailSendingEnabled()) {
    return { ok: true, sent: 0, skipped: true, reason: "EMAIL_SENDING_ENABLED" };
  }

  const emailConfig = await loadEmailConfig(admin);
  if (emailConfig.digests_paused) {
    return {
      ok: true,
      sent: 0,
      skipped: true,
      reason: "digests_paused",
      paused_at: emailConfig.paused_at,
    };
  }

  const upcoming = await loadUpcomingEvents(admin);
  if (upcoming.length === 0) {
    return { ok: true, sent: 0, message: "No upcoming active events to include", prefs_checked: 0 };
  }

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("*")
    .in("frequency", freqs);

  let sent = 0;
  let skippedDisabled = 0;
  let skippedInactive = 0;
  let skippedSuppressed = 0;
  let skippedAlreadySent = 0;
  let skippedNoMatch = 0;
  let skippedCap = 0;
  const errors = [];
  const adsByZip = new Map();
  const inactivityMs = emailConfig.inactivity_days * 24 * 60 * 60 * 1000;
  const maxSends = emailConfig.max_sends_per_run;
  const now = new Date();

  const adsForZipCached = async (zip) => {
    const key = zip || "__none__";
    if (adsByZip.has(key)) return adsByZip.get(key);
    const ads = await loadAdsForZip(admin, zip);
    adsByZip.set(key, ads);
    return ads;
  };

  for (const pref of prefs || []) {
    if (sent >= maxSends) {
      skippedCap += 1;
      continue;
    }

    const { data: recipient } = await admin
      .from("profiles")
      .select("id, email, first_name, role, zip_code, last_seen_at, created_at")
      .eq("id", pref.user_id)
      .maybeSingle();
    if (!recipient?.email) continue;
    if (recipient.role === "admin" || recipient.role === "organizer") continue;
    if (recipient.role === "disabled") {
      skippedDisabled += 1;
      await turnOffDigest(admin, pref.user_id);
      continue;
    }

    const lastSeen = recipient.last_seen_at || recipient.created_at;
    if (lastSeen && now.getTime() - new Date(lastSeen).getTime() > inactivityMs) {
      skippedInactive += 1;
      await turnOffDigest(admin, pref.user_id);
      continue;
    }

    if (await isEmailSuppressed(admin, recipient.email)) {
      skippedSuppressed += 1;
      await turnOffDigest(admin, pref.user_id);
      continue;
    }

    if (alreadySentDigestThisWeek(pref.last_digest_sent_at, now)) {
      skippedAlreadySent += 1;
      continue;
    }

    let favIds = [];
    if (pref.include_fav_organizers) {
      favIds = await favPosterIdsForUser(admin, pref.user_id);
    }

    const matched = upcoming
      .filter((ev) => eventMatchesPref(ev, pref, favIds))
      .slice(0, 8);
    if (matched.length === 0) {
      skippedNoMatch += 1;
      continue;
    }

    const zip = zipForDigest(pref, recipient.zip_code);
    const ads = await adsForZipCached(zip);
    const unsubPage = digestUnsubscribeUrl(recipient.id);
    const unsubApi = digestUnsubscribeApiUrl(recipient.id);

    try {
      const html = buildDigestHtml({
        userName: recipient.first_name || "there",
        events: matched,
        frequency: pref.frequency,
        ads,
        unsubscribeUrl: unsubPage,
      });
      const result = await sendViaResend({
        to: recipient.email,
        subject: `🌟 ${matched.length} kids' activities for you — Local Kids Calendar`,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubApi}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      if (result.skipped) {
        return {
          ok: true,
          sent,
          skipped: true,
          reason: result.reason,
          errors,
          prefs_checked: (prefs || []).length,
          skipped_disabled: skippedDisabled,
          skipped_inactive: skippedInactive,
          skipped_suppressed: skippedSuppressed,
          skipped_already_sent: skippedAlreadySent,
          skipped_no_match: skippedNoMatch,
          skipped_cap: skippedCap,
        };
      }
      await admin
        .from("notification_preferences")
        .update({
          last_digest_sent_at: now.toISOString(),
          updated_at: now.toISOString(),
        })
        .eq("user_id", pref.user_id);
      sent += 1;
      if (SEND_DELAY_MS > 0) await sleep(SEND_DELAY_MS);
    } catch (err) {
      errors.push({ email: recipient.email, error: err.message });
    }
  }

  return {
    ok: true,
    sent,
    errors,
    prefs_checked: (prefs || []).length,
    skipped_disabled: skippedDisabled,
    skipped_inactive: skippedInactive,
    skipped_suppressed: skippedSuppressed,
    skipped_already_sent: skippedAlreadySent,
    skipped_no_match: skippedNoMatch,
    skipped_cap: skippedCap,
    max_sends_per_run: maxSends,
  };
}

/**
 * Cron schedule: weekly digests only, on Tuesdays (America/Los_Angeles).
 */
export function frequenciesForToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === "weekday")?.value;
  return weekday === "Tue" ? ["weekly"] : [];
}
