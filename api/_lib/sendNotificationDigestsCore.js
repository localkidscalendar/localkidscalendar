import { sendViaResend } from "./resendSend.js";
import { buildDigestHtml } from "../../shared/digestEmailHtml.js";
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
const SEND_DELAY_MS = 50;

export { buildDigestHtml };

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
    appUrl: APP_URL,
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
        appUrl: APP_URL,
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
