import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { isAuthorizedInternalCall } from '../../shared/internalAuth.ts';

// Haversine formula to calculate distance in miles between two lat/lng points
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Geocode a zip code using zippopotam.us
async function geocodeZip(zip) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      lat: parseFloat(data.places[0].latitude),
      lon: parseFloat(data.places[0].longitude),
    };
  } catch {
    return null;
  }
}

// Check if an event matches a user's favorite organizers
function eventMatchesFavOrganizers(event, favOrganizerUserIds) {
  if (!favOrganizerUserIds || favOrganizerUserIds.length === 0) return false;
  return favOrganizerUserIds.includes(event.created_by_id);
}

// Check if an event matches the "Other Activities" criteria (locations, keywords, age) — ALL set criteria must match
// prefLocationCoords: array of geocoded {lat, lon} for each of the pref's locations (parallel to pref.locations)
function eventMatchesOtherCriteria(event, pref, prefLocationCoords, eventCoords) {
  if (!pref.include_other_activities) return false;

  const locations = pref.locations || [];
  const hasZip = locations.length > 0;
  const hasKeywords = !!(pref.keywords && pref.keywords.trim());
  const hasAge = pref.age_min != null || pref.age_max != null;

  // No criteria set — nothing to match on for this section
  if (!hasZip && !hasKeywords && !hasAge) return false;

  if (hasKeywords) {
    const kws = pref.keywords.toLowerCase().split(/[\s,]+/).filter(Boolean);
    const haystack = `${event.title} ${event.description} ${event.keywords || ''}`.toLowerCase();
    if (!kws.some((kw) => haystack.includes(kw))) return false;
  }

  if (hasAge) {
    if (pref.age_min != null && event.age_max != null && event.age_max < pref.age_min) return false;
    if (pref.age_max != null && event.age_min != null && event.age_min > pref.age_max) return false;
  }

  if (hasZip) {
    if (!eventCoords) return false;
    // Match if the event falls within the radius of ANY of the user's saved locations
    const withinAnyLocation = locations.some((loc, idx) => {
      const coords = prefLocationCoords[idx];
      if (!coords || !loc.radius_miles) return false;
      const dist = distanceMiles(coords.lat, coords.lon, eventCoords.lat, eventCoords.lon);
      return dist <= loc.radius_miles;
    });
    if (!withinAnyLocation) return false;
  }

  return true;
}

// Overall match: favorite organizer activity OR matches all set "Other Activities" criteria
function eventMatchesPref(event, pref, prefLocationCoords, eventCoords, favOrganizerUserIds) {
  if (pref.include_fav_organizers && eventMatchesFavOrganizers(event, favOrganizerUserIds)) return true;
  return eventMatchesOtherCriteria(event, pref, prefLocationCoords, eventCoords);
}

function formatEventCard(event) {
   const dateStr = event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
   const location = [event.city, event.state].filter(Boolean).join(', ');
   const cost = event.cost ? (event.cost.startsWith('$') ? event.cost : `$${event.cost}`) : 'Free';
   const ages = (event.age_min != null && event.age_max != null)
     ? `Ages ${event.age_min}–${event.age_max}`
     : event.age_min != null ? `Ages ${event.age_min}+` : '';

   const categoryColor = {
     'camp': '#E0F7F2',
     'class': '#E0F7F2',
     'event': '#E0F7F2',
     'sport': '#E0F7F2',
     'general_interest': '#F5E6D3'
   }[event.category] || '#E0F7F2';

   const categoryTextColor = {
     'camp': '#2D7A3E',
     'class': '#2D7A3E',
     'event': '#2D7A3E',
     'sport': '#2D7A3E',
     'general_interest': '#B36D25'
   }[event.category] || '#2D7A3E';

   return `
     <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:0;margin-bottom:16px;overflow:hidden;">
       ${event.event_image ? `<img src="${event.event_image}" alt="${event.title}" style="width:100%;max-height:160px;object-fit:cover;display:block;" />` : ''}
       <div style="padding:16px;">
         <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
           <span style="display:inline-block;background:${categoryColor};color:${categoryTextColor};font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;text-transform:capitalize;">${event.category}</span>
         </div>
         <h3 style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1a2332;line-height:1.4;">${event.title}</h3>
         ${event.org_name ? `<p style="margin:0 0 8px;font-size:12px;color:#6b7280;">by <strong style="color:#1a2332;">${event.org_name}</strong></p>` : ''}
         <div style="margin-bottom:12px;border-top:1px solid #f0f0f0;padding-top:8px;">
           ${dateStr ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">📅 ${dateStr}</div>` : ''}
           ${location ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">📍 ${location}</div>` : ''}
           ${ages ? `<div style="margin:0 0 6px;font-size:12px;color:#6b7280;">👥 ${ages}</div>` : ''}
           <div style="font-size:12px;color:#6b7280;">💰 ${cost}</div>
         </div>
         <a href="https://app.localkidscalendar.com/event/${event.id}" style="display:inline-block;background:#2D7A3E;color:#fff;padding:8px 14px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;border:none;cursor:pointer;">View Details</a>
       </div>
     </div>
   `;
}

function formatAdsSection(ads) {
  if (!ads || ads.length === 0) return '';
  const cells = ads.map((ad) => `
    <td style="padding:0 4px;" valign="top">
      <a href="${ad.link_url}" style="display:block;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <img src="${ad.image_url}" alt="Supporter ad" style="width:100%;display:block;" />
      </a>
    </td>
  `).join('');
  return `
    <div style="margin-top:8px;margin-bottom:16px;">
      <p style="margin:0 0 6px;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;">Supporters</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>
    </div>
  `;
}

function buildEmailHtml(userName, events, frequency, ads) {
   const freqLabel = frequency === 'daily' ? 'Daily' : frequency === 'monthly' ? 'Monthly' : 'Weekly';
   const eventCards = events.map(formatEventCard).join('') + formatAdsSection(ads);
   return `
     <!DOCTYPE html>
     <html>
     <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
     <body style="margin:0;padding:0;background:#f8f9fa;font-family:'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#374151;">
       <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;padding:32px 16px;">
         <tr><td align="center">
           <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
             <!-- Header -->
             <tr><td style="background:#2D7A3E;padding:32px 24px;text-align:center;">
               <h1 style="margin:0;color:#fff;font-size:24px;font-weight:800;letter-spacing:-0.5px;">LocalKidsCalendar</h1>
               <p style="margin:8px 0 0;color:#C9E8D8;font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:0.5px;">${freqLabel} Activity Digest</p>
             </td></tr>
             <!-- Hero Section -->
             <tr><td style="background:#fff;padding:24px 24px;border-bottom:1px solid #e5e7eb;">
               <p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#1a2332;">Hi ${userName || 'there'}! 👋</p>
               <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">We found ${events.length} new activit${events.length === 1 ? 'y' : 'ies'} matching your interests. Check them out:</p>
             </td></tr>
             <!-- Events -->
             <tr><td style="background:#fff;padding:20px 24px;">
               ${eventCards}
             </td></tr>
             <!-- Footer Section -->
             <tr><td style="background:#f9fafb;padding:20px 24px;border-top:1px solid #e5e7eb;text-align:center;">
               <p style="margin:0 0 12px;font-size:12px;color:#6b7280;">Want to tweak your interests?</p>
               <a href="https://app.localkidscalendar.com/notifications" style="display:inline-block;background:#fff;border:1px solid #d1d5db;color:#2D7A3E;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:12px;font-weight:600;">Manage Preferences</a>
             </td></tr>
             <!-- Bottom Footer -->
             <tr><td style="background:#fff;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
               <p style="margin:0;font-size:11px;color:#9ca3af;">© 2024 LocalKidsCalendar · Community-powered kids' activities</p>
             </td></tr>
           </table>
         </td></tr>
       </table>
     </body>
     </html>
   `;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json().catch(() => ({}));

    // Allow both the scheduled automation (internal call token) and manual admin calls
    if (!(await isAuthorizedInternalCall(base44, payload))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const targetFrequency = payload.frequency || 'all'; // 'daily' | 'weekly' | 'monthly' | 'all'
    const previewTo = payload.preview_to || null; // if set, send only to this email address

    // Determine which frequencies to send based on today
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const dayOfMonth = today.getDate();

    const frequenciesToSend = [];
    if (targetFrequency === 'all') {
      frequenciesToSend.push('daily');
      if (dayOfWeek === 1) frequenciesToSend.push('weekly'); // Mondays
      if (dayOfMonth === 1) frequenciesToSend.push('monthly'); // 1st of month
    } else {
      frequenciesToSend.push(targetFrequency);
    }

    // Load all active events from the last 7 days + upcoming
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 1);
    const allEvents = await base44.asServiceRole.entities.Event.filter({ status: 'active' }, '-created_date', 200);
    const recentEvents = allEvents.filter((e) => {
      if (!e.start_date) return false;
      const start = new Date(e.start_date);
      return start >= cutoff;
    });

    if (recentEvents.length === 0) {
      return Response.json({ message: 'No upcoming events to notify about', sent: 0 });
    }

    // Pre-geocode event zip codes
    const eventGeoCache = {};
    for (const event of recentEvents) {
      if (event.zip_code && !eventGeoCache[event.zip_code] && event.latitude && event.longitude) {
        eventGeoCache[event.zip_code] = { lat: event.latitude, lon: event.longitude };
      } else if (event.zip_code && !eventGeoCache[event.zip_code]) {
        eventGeoCache[event.zip_code] = await geocodeZip(event.zip_code);
      }
    }

    // Load all notification preferences where frequency is in frequenciesToSend
    const allPrefs = await base44.asServiceRole.entities.NotificationPreference.list('-created_date', 500);
    const activePrefs = allPrefs.filter((p) => frequenciesToSend.includes(p.frequency));

    // Load active supporter ads (and default filler ads as fallback) to feature in emails
    const activeBannerAds = await base44.asServiceRole.entities.BannerAd.filter({ status: 'active' }, '-created_date', 200);
    const activeDefaultAds = await base44.asServiceRole.entities.AdminDefaultAd.filter({ status: 'active' }, '-created_date', 50);

    function getAdsForZip(zip) {
      const zipMatches = zip ? activeBannerAds.filter((a) => a.zip_code === zip) : [];
      const pool = zipMatches.length > 0 ? zipMatches : (activeBannerAds.length > 0 ? activeBannerAds : activeDefaultAds);
      return pool.map((a) => ({ image_url: a.image_url, link_url: a.link_url }));
    }

    // Preview mode: send a sample email directly to the requesting admin
    if (previewTo) {
      const subject = `🌟 [Preview] ${recentEvents.length} new kids' activit${recentEvents.length === 1 ? 'y' : 'ies'} near you!`;
      const html = buildEmailHtml('', recentEvents.slice(0, 5), targetFrequency === 'all' ? 'weekly' : targetFrequency, getAdsForZip(null));
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: previewTo,
        subject,
        body: html,
        from_name: 'LocalKidsCalendar',
      });
      return Response.json({ success: true, sent: 1, eventsConsidered: recentEvents.length });
    }

    if (activePrefs.length === 0) {
      return Response.json({ message: 'No preferences matching frequencies', sent: 0 });
    }

    // Load all users to map created_by_id → email + name
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const userMap = {};
    allUsers.forEach((u) => { userMap[u.id] = u; });

    // Load all Organizer records to resolve Organizer.id -> Organizer.user_id (created_by_id on events)
    const allOrganizers = await base44.asServiceRole.entities.Organizer.list('-created_date', 500);
    const organizerUserIdById = {};
    allOrganizers.forEach((o) => { organizerUserIdById[o.id] = o.user_id; });

    // Load all favorite-organizer records to know which organizers each user has favorited
    const allFavorites = await base44.asServiceRole.entities.FavoriteOrganizer.list('-created_date', 1000);
    const favOrganizerUserIdsByPosterUserId = {};
    allFavorites.forEach((f) => {
      const organizerUserId = organizerUserIdById[f.organizer_id];
      if (!organizerUserId) return;
      if (!favOrganizerUserIdsByPosterUserId[f.poster_user_id]) favOrganizerUserIdsByPosterUserId[f.poster_user_id] = [];
      favOrganizerUserIdsByPosterUserId[f.poster_user_id].push(organizerUserId);
    });

    let sentCount = 0;
    const prefGeoCache = {};

    for (const pref of activePrefs) {
      const user = userMap[pref.created_by_id];
      if (!user || !user.email) continue;
      if (user.role === 'organizer' || user.role === 'admin') continue;

      // Geocode each of the user's saved locations
      const locations = pref.locations || [];
      const prefLocationCoords = [];
      for (const loc of locations) {
        if (loc.zip_code && !prefGeoCache[loc.zip_code]) {
          prefGeoCache[loc.zip_code] = await geocodeZip(loc.zip_code);
        }
        prefLocationCoords.push(loc.zip_code ? prefGeoCache[loc.zip_code] : null);
      }
      const favOrganizerUserIds = favOrganizerUserIdsByPosterUserId[pref.created_by_id] || [];

      // Find matching events
      const matched = recentEvents.filter((event) => {
        const eventCoords = event.zip_code ? eventGeoCache[event.zip_code] : null;
        return eventMatchesPref(event, pref, prefLocationCoords, eventCoords, favOrganizerUserIds);
      });

      if (matched.length === 0) continue;

      // Send email
      const userName = user.full_name || user.first_name || '';
      const subject = `🌟 ${matched.length} new kids' activit${matched.length === 1 ? 'y' : 'ies'} near you!`;
      const html = buildEmailHtml(userName, matched, pref.frequency, getAdsForZip(locations[0]?.zip_code));

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        subject,
        body: html,
        from_name: 'LocalKidsCalendar',
      });

      sentCount++;
    }

    return Response.json({ success: true, sent: sentCount, eventsConsidered: recentEvents.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});