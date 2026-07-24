import React, { useState, useEffect, useMemo, useRef } from "react";
import { useOutletContext, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import EventCard from "@/components/events/EventCard";
import EventFilters from "@/components/events/EventFilters";
import useGeoLocation from "@/lib/useGeoLocation";
import useBetaConfig, { isZipAllowed } from "@/lib/useBetaConfig";
import SupporterAdCard from "@/components/ads/SupporterAdCard";
import DefaultAdCard from "@/components/ads/DefaultAdCard";
import ZipRequiredModal from "@/components/shared/ZipRequiredModal";
import AuthPromptModal from "@/components/shared/AuthPromptModal";
import { pickDefaultFillerAds } from "@/lib/pickDefaultFillerAds";
import { isActivityFree, normalizeCategoryList } from "@/lib/activityCategories";
import { Calendar, MapPin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import moment from "moment";

const FILTER_SESSION_KEY = "home_filters_session";

// Shuffles an array (Fisher-Yates) with an offset for rotation
function rotatedShuffle(arr, seed) {
  if (!arr.length) return [];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = (i + seed) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Injects supporter ads into the event feed grid
function AdInjectedFeed({ events, ads, rotationIndex, zipCode, savedEventIds, onToggleSave, user }) {
  const COLS = 3; // grid columns on lg

  // ads is { type: "paid"|"default", ad } — filter paid ads by zip, keep defaults always
  const relevantAds = (ads || []).filter((item) => {
    if (!item || typeof item !== "object") return false;
    if (item.type === "default") return true;
    if (!zipCode) return true;
    const ad = item.ad;
    return !!ad && ad.zip_code === zipCode;
  });

  const rotatedAds = rotatedShuffle(relevantAds, rotationIndex);

  // If fewer than 6 events, show ads on bottom row only
  if (events.length < 6 || rotatedAds.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
        {events.map((event) => <EventCard key={event.id} event={event} isSaved={savedEventIds.has(event.id)} onToggleSave={onToggleSave} />)}
        {rotatedAds.map(({ type, ad }) =>
          type === "paid"
            ? <SupporterAdCard key={ad.id} ad={ad} user={user} />
            : <DefaultAdCard key={`d-${ad.id}`} ad={ad} />
        )}
      </div>
    );
  }

  // Otherwise: ads appear in top 3 rows, one per row, not same row as each other
  // Build combined grid: insert one ad per row at a different position in rows 1, 2, 3
  const adPositionsInRow = [
    rotationIndex % COLS,
    (rotationIndex + 1) % COLS,
    (rotationIndex + 2) % COLS,
  ];

  // Build rows
  const rows = [];
  let eventIdx = 0;
  let adIdx = 0;
  let rowNum = 0;

  while (eventIdx < events.length || adIdx < rotatedAds.length) {
    const row = [];
    const injectAdThisRow = adIdx < rotatedAds.length && rowNum < 3;
    const adPositionInThisRow = injectAdThisRow ? adPositionsInRow[rowNum] : -1;
    let colsFilled = 0;

    for (let col = 0; col < COLS; col++) {
      if (col === adPositionInThisRow && adIdx < rotatedAds.length) {
        row.push({ type: "ad", data: rotatedAds[adIdx++] });
        colsFilled++;
      } else if (eventIdx < events.length) {
        row.push({ type: "event", data: events[eventIdx++] });
        colsFilled++;
      }
    }


    if (colsFilled > 0) rows.push(row);
    rowNum++;

    // Safety: if no progress made, break
    if (colsFilled === 0) break;
  }

  const flatItems = rows.flat();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
      {flatItems.map((item, i) => {
        if (item.type === "event") return <EventCard key={`ev-${item.data.id}`} event={item.data} isSaved={savedEventIds.has(item.data.id)} onToggleSave={onToggleSave} />;
        const { type: adType, ad } = item.data;
        return adType === "paid"
          ? <SupporterAdCard key={`ad-${ad.id}`} ad={ad} user={user} />
          : <DefaultAdCard key={`def-${ad.id}-${i}`} ad={ad} />;
      })}
    </div>
  );
}

export default function Home() {
  const { user, userLoading } = useOutletContext();
  const location = useLocation();
  const geo = useGeoLocation();
  const betaConfig = useBetaConfig(); // BETA MODE — remove with useBetaConfig.js
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savedEventIds, setSavedEventIds] = useState(new Set());
  const [savedEventRecords, setSavedEventRecords] = useState([]);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [favoriteOrganizerIds, setFavoriteOrganizerIds] = useState(new Set());
  const [orgFilter, setOrgFilter] = useState(""); // set when coming from Organizer Directory
  const [filters, setFilters] = useState(() => {
    const defaults = {
      search: "", category: "all", activeStatus: "active", sortBy: "posted",
      zipCode: "", radiusMiles: 15, ageMin: "", ageMax: "", priceMin: "", priceMax: "",
      freeOnly: false,
      dateFrom: moment().toDate(), dateTo: moment().add(120, "days").toDate(), savedOnly: false, favOrgsOnly: false
    };
    // Restore all non-location filters from this browser session (cleared when the session ends)
    try {
      const saved = sessionStorage.getItem(FILTER_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dateFrom) parsed.dateFrom = new Date(parsed.dateFrom);
        if (parsed.dateTo) parsed.dateTo = new Date(parsed.dateTo);
        Object.assign(defaults, parsed);
      }
    } catch {}
    // Restore an in-session zip/radius selection synchronously, before any effects run,
    // so returning to this page mid-session never shows the zip prompt again.
    try {
      const savedZip = sessionStorage.getItem("session_zip_current");
      if (savedZip) {
        const savedRadius = sessionStorage.getItem("session_radius");
        defaults.zipCode = savedZip;
        defaults.radiusMiles = savedRadius ? Number(savedRadius) : 15;
      }
    } catch {}
    return defaults;
  });
  const [expandFilters, setExpandFilters] = useState(false);
  const expandCheckedRef = useRef(false);
  const [sessionDefaultZip, setSessionDefaultZip] = useState(null); // zip "Clear" reverts to
  const [locationInitialized, setLocationInitialized] = useState(() => {
    try {
      return !!sessionStorage.getItem("session_zip_current");
    } catch {
      return false;
    }
  });

  // Apply ?org= query param to filter strictly by org_name
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const org = params.get("org");
    setOrgFilter(org || "");
  }, [location.search]);

  // Persist all non-location filters for the remainder of this browser session
  useEffect(() => {
    try {
      const { zipCode, radiusMiles, ...rest } = filters;
      sessionStorage.setItem(FILTER_SESSION_KEY, JSON.stringify(rest));
    } catch {}
  }, [filters]);

  // Auto-expand the extra filters panel, once, if the restored session filters differ from defaults
  useEffect(() => {
    if (expandCheckedRef.current || !locationInitialized || sessionDefaultZip === null) return;
    expandCheckedRef.current = true;
    const ageSet = filters.ageMin || filters.ageMax;
    const priceSet = filters.priceMin || filters.priceMax;
    if (ageSet || priceSet) setExpandFilters(true);
  }, [locationInitialized, sessionDefaultZip, filters.ageMin, filters.ageMax, filters.priceMin, filters.priceMax]);

  const detectedZip = geo.zip;

  // Sets the active zip/radius filter and persists it for the remainder of the session
  const setCurrentZip = (zip, radius = 15) => {
    setFilters((prev) => ({ ...prev, zipCode: zip, radiusMiles: radius }));
    setLocationInitialized(true);
    try {
      sessionStorage.setItem("session_zip_current", zip);
      sessionStorage.setItem("session_radius", String(radius));
    } catch {}
  };

  // Determine the location filter for this session in a single pass (avoids multi-render races):
  // - Signed-in users always use their profile zip — never geolocation, and never a leftover
  //   session zip carried over from a different (or signed-out) identity.
  // - Signed-out users restore an in-session selection if present, otherwise fall back to geolocation.
  useEffect(() => {
    if (userLoading) return;

    try {
      const currentMarker = user ? user.id : "guest";
      const lastMarker = sessionStorage.getItem("session_user_marker");
      const identityChanged = lastMarker !== null && lastMarker !== currentMarker;
      sessionStorage.setItem("session_user_marker", currentMarker);

      if (identityChanged) {
        sessionStorage.removeItem("session_zip_current");
        sessionStorage.removeItem("session_radius");
      }

      if (locationInitialized && !identityChanged) return;

      if (user) {
        setCurrentZip(user.zip_code || "");
        return;
      }

      if (!identityChanged) {
        const savedCurrent = sessionStorage.getItem("session_zip_current");
        if (savedCurrent) {
          const savedRadius = sessionStorage.getItem("session_radius");
          setFilters((prev) => ({ ...prev, zipCode: savedCurrent, radiusMiles: savedRadius ? Number(savedRadius) : 15 }));
          setLocationInitialized(true);
          return;
        }
      }

      if (!geo.loading) {
        setCurrentZip(detectedZip || "");
      }
    } catch {}
  }, [user, userLoading, geo.loading, detectedZip, locationInitialized]);

  // The "true" default (profile zip, else geolocation) that Clear always reverts to —
  // computed independently of any manual zip overrides so it's never polluted by them.
  useEffect(() => {
    if (userLoading) return;
    if (user && user.zip_code) {
      setSessionDefaultZip(user.zip_code);
    } else if (!geo.loading) {
      setSessionDefaultZip(detectedZip || "");
    }
  }, [user, userLoading, geo.loading, detectedZip]);

  // Safety net: if we ever end up with no zip while signed in with a profile zip on file,
  // use it instead of blocking the user with the required-zip prompt.
  useEffect(() => {
    if (!locationInitialized || filters.zipCode || userLoading) return;
    if (user && user.zip_code) {
      setCurrentZip(user.zip_code);
    }
  }, [locationInitialized, filters.zipCode, userLoading, user]);

  // Keep this session's current zip/radius selection persisted for the remainder of the session
  useEffect(() => {
    if (!locationInitialized) return;
    try {
      sessionStorage.setItem("session_zip_current", filters.zipCode || "");
      sessionStorage.setItem("session_radius", String(filters.radiusMiles || 15));
    } catch {}
  }, [filters.zipCode, filters.radiusMiles, locationInitialized]);

  const [activeAds, setActiveAds] = useState([]);
  const [adRotationIndex, setAdRotationIndex] = useState(0);
  const adRotationRef = useRef(null);

  const [showDistancePicker, setShowDistancePicker] = useState(false);
  const [filterCenter, setFilterCenter] = useState(null); // {lat, lng} for the entered filter zip
  const [zipCoordsMap, setZipCoordsMap] = useState({}); // zip_code -> {lat, lng} for events

  // Haversine distance in miles between two lat/lng points
  const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const geocodeZip = async (zip) => {
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) return null;
      const data = await res.json();
      const place = data.places?.[0];
      if (place) return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
    } catch {}
    return null;
  };

  // Geocode the filter zip when it changes
  useEffect(() => {
    if (!filters.zipCode || filters.zipCode.length < 5) { setFilterCenter(null); return; }
    geocodeZip(filters.zipCode).then(coords => setFilterCenter(coords));
  }, [filters.zipCode]);

  // Geocode all unique event zip codes when events load
  useEffect(() => {
    if (!events.length) return;
    const uniqueZips = [...new Set(events.map(e => e.zip_code).filter(z => z && z.length >= 5))];
    const toGeocode = uniqueZips.filter(z => !zipCoordsMap[z]);
    if (!toGeocode.length) return;
    Promise.all(toGeocode.map(async (zip) => {
      const coords = await geocodeZip(zip);
      return { zip, coords };
    })).then(results => {
      const newMap = {};
      results.forEach(({ zip, coords }) => { if (coords) newMap[zip] = coords; });
      if (Object.keys(newMap).length) setZipCoordsMap(prev => ({ ...prev, ...newMap }));
    });
  }, [events]);

  useEffect(() => {
    loadEvents();
    loadAds();
    if (user) loadFavorites();
  }, [user]);

  // Reload ads when zip changes so default filler count updates
  useEffect(() => {
    loadAds();
  }, [filters.zipCode]);

  const loadAds = async () => {
    try {
      const zip = (filters.zipCode || "").trim();

      let paidQuery = supabase
        .from("banner_ads")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50);
      if (zip) paidQuery = paidQuery.eq("zip_code", zip);

      const [{ data: paidAds, error }, { data: defaultAds }, zipConfigResult] = await Promise.all([
        paidQuery,
        supabase
          .from("admin_default_ads")
          .select("*")
          .eq("status", "active")
          .order("priority", { ascending: false })
          .limit(10),
        zip
          ? supabase.from("ad_zip_config").select("max_slots").eq("zip_code", zip).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (error) throw error;

      const maxSlots = zipConfigResult?.data?.max_slots
        ? Number(zipConfigResult.data.max_slots) || 3
        : 3;
      const paid = paidAds || [];
      const emptySlots = Math.max(0, maxSlots - paid.length);
      const fillers = pickDefaultFillerAds(defaultAds || [], emptySlots);

      // AdInjectedFeed expects { type: "paid"|"default", ad } wrappers
      setActiveAds([
        ...paid.map((ad) => ({ type: "paid", ad })),
        ...fillers.map((ad) => ({ type: "default", ad })),
      ]);
    } catch {
      setActiveAds([]);
    }
  };

  // Rotate ad positions every 30 seconds
  useEffect(() => {
    clearInterval(adRotationRef.current);
    if (activeAds.length > 1) {
      adRotationRef.current = setInterval(() => {
        setAdRotationIndex((prev) => (prev + 1) % activeAds.length);
      }, 30000);
    }
    return () => clearInterval(adRotationRef.current);
  }, [activeAds]);

  const loadFavorites = async () => {
    try {
      const [{ data: saved, error: savedError }, { data: favOrgs, error: favError }] = await Promise.all([
        supabase.from("saved_events").select("*").eq("user_id", user.id),
        supabase.from("favorite_organizers").select("*").eq("user_id", user.id),
      ]);
      if (savedError) throw savedError;
      if (favError) throw favError;
      setSavedEventRecords(saved || []);
      setSavedEventIds(new Set((saved || []).map((s) => s.event_id)));
      setFavoriteOrganizerIds(
        new Set((favOrgs || []).map((f) => f.poster_user_id || f.organizer_id).filter(Boolean))
      );
    } catch {
      setSavedEventRecords([]);
      setSavedEventIds(new Set());
      setFavoriteOrganizerIds(new Set());
    }
  };

  const toggleSave = async (eventId) => {
    if (!user) return setAuthPrompt(true);
    const event = events.find((e) => e.id === eventId);
    try {
      if (savedEventIds.has(eventId)) {
        const record = savedEventRecords.find((r) => r.event_id === eventId);
        if (record) {
          const { error } = await supabase.from("saved_events").delete().eq("id", record.id);
          if (error) throw error;
          if (event) {
            await supabase
              .from("events")
              .update({ save_count: Math.max(0, (event.save_count || 0) - 1) })
              .eq("id", eventId);
          }
          setSavedEventRecords((prev) => prev.filter((r) => r.event_id !== eventId));
          setSavedEventIds((prev) => {
            const s = new Set(prev);
            s.delete(eventId);
            return s;
          });
        }
      } else {
        const { data: record, error } = await supabase
          .from("saved_events")
          .insert({ event_id: eventId, user_id: user.id })
          .select("*")
          .single();
        if (error) throw error;
        if (event) {
          await supabase
            .from("events")
            .update({ save_count: (event.save_count || 0) + 1 })
            .eq("id", eventId);
        }
        setSavedEventRecords((prev) => [...prev, record]);
        setSavedEventIds((prev) => new Set([...prev, eventId]));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setEvents(data || []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
  };

  const filteredEvents = useMemo(() => {
    // BETA MODE — remove this filter block along with useBetaConfig.js
    let result = events.filter((e) => isZipAllowed(e.zip_code, betaConfig));
    const today = moment().startOf("day");

    // Filter active vs inactive
    if (filters.activeStatus === "inactive") {
      result = result.filter((e) => {
        const end = e.end_date ? moment(e.end_date) : moment(e.start_date);
        return end.isBefore(today);
      });
    } else {
      result = result.filter((e) => {
        const end = e.end_date ? moment(e.end_date) : moment(e.start_date);
        return end.isSameOrAfter(today);
      });
    }

    if (filters.category && filters.category !== "all") {
      result = result.filter((e) => {
        const cats = normalizeCategoryList(e.category);
        return cats.includes(filters.category);
      });
    }
    if (filters.freeOnly) {
      result = result.filter((e) => isActivityFree(e));
    }
    if (filters.zipCode) {
      const radius = Number(filters.radiusMiles) || 15;
      if (filterCenter) {
        result = result.filter((e) => {
          // Use event's stored lat/lng if available
          if (e.latitude && e.longitude) {
            return haversineDistance(filterCenter.lat, filterCenter.lng, e.latitude, e.longitude) <= radius;
          }
          // Fall back to geocoded zip coords
          const eventCoords = e.zip_code && zipCoordsMap[e.zip_code];
          if (eventCoords) {
            return haversineDistance(filterCenter.lat, filterCenter.lng, eventCoords.lat, eventCoords.lng) <= radius;
          }
          // Last resort: exact zip match
          return e.zip_code === filters.zipCode;
        });
      } else {
        // filterCenter not loaded yet (geocoding in flight), just do zip match
        result = result.filter((e) => e.zip_code === filters.zipCode);
      }
    }
    if (filters.ageMin) {
      result = result.filter((e) => !e.age_max || e.age_max >= Number(filters.ageMin));
    }
    if (filters.ageMax) {
      result = result.filter((e) => !e.age_min || e.age_min <= Number(filters.ageMax));
    }
    if (!filters.freeOnly && (filters.priceMin || filters.priceMax)) {
      result = result.filter((e) => {
        const raw = (e.cost || "").replace(/[^0-9.]/g, "");
        const price = parseFloat(raw);
        if (isNaN(price)) return true; // keep free/unknown if no numeric cost
        if (filters.priceMin && price < Number(filters.priceMin)) return false;
        if (filters.priceMax && price > Number(filters.priceMax)) return false;
        return true;
      });
    }
    if (filters.dateFrom) {
      const from = moment(filters.dateFrom);
      result = result.filter((e) => {
        const end = e.end_date ? moment(e.end_date) : moment(e.start_date);
        return end.isSameOrAfter(from);
      });
    }
    if (filters.dateTo) {
      const to = moment(filters.dateTo);
      result = result.filter((e) => moment(e.start_date).isSameOrBefore(to));
    }
    if (orgFilter) {
      const q = orgFilter.toLowerCase();
      result = result.filter((e) => (e.org_name || "").toLowerCase() === q);
    } else if (filters.search) {
      // Strip punctuation, split into individual words, and match if ANY word
      // appears anywhere in the activity's searchable text (OR across words).
      const words = filters.search
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
      if (words.length > 0) {
        result = result.filter((e) => {
          const haystack = [e.title, e.description, e.keywords, e.org_name, e.city]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return words.some((w) => haystack.includes(w));
        });
      }
    }

    // Sort
    if (filters.sortBy === "start") {
      result.sort((a, b) => moment(a.start_date).diff(moment(b.start_date)));
    } else if (filters.sortBy === "registration") {
      result.sort((a, b) => moment(a.registration_start || a.start_date).diff(moment(b.registration_start || b.start_date)));
    } else {
      // posted — most recently posted first (default)
      result.sort((a, b) => moment(b.created_date).diff(moment(a.created_date)));
    }

    if (filters.savedOnly) {
      result = result.filter((e) => savedEventIds.has(e.id));
    }
    if (filters.favOrgsOnly) {
      result = result.filter((e) => e.created_by_id && favoriteOrganizerIds.has(e.created_by_id));
    }

    return result;
  }, [events, filters, orgFilter, savedEventIds, favoriteOrganizerIds, filterCenter, zipCoordsMap, betaConfig]);

  if (locationInitialized && !filters.zipCode) {
    return <ZipRequiredModal onSubmit={setCurrentZip} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <AuthPromptModal open={authPrompt} onOpenChange={setAuthPrompt} message="Sign in to save activities and find them later in your account." />
      {/* Hero */}
      <div className="mb-8 text-center">
        <h1 className="font-heading font-bold text-3xl sm:text-4xl lg:text-5xl text-foreground mb-3">
          Discover Your Kids Activities
          <span className="block text-mint-500">In Your Community</span>
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">Community-powered hub for local kids activities<br />Camps, classes, events, sports & more for local kids</p>
        {filters.zipCode &&
        <div className="inline-flex items-center gap-2 flex-wrap justify-center mt-3">
            <button
            onClick={() => setShowDistancePicker((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground bg-mint-50 px-3 py-1.5 rounded-full border border-mint-200 hover:border-mint-300 transition-colors">
              <MapPin className="w-3.5 h-3.5 text-mint-500" />
              <span>Showing activities in <strong>{filters.zipCode}</strong> + <strong>{filters.radiusMiles} miles</strong></span>
            </button>
            {showDistancePicker &&
          <div className="inline-flex items-center gap-1.5 bg-white border border-border rounded-full px-3 py-1.5">
              <span className="text-xs text-muted-foreground">Zip:</span>
              <input
              value={filters.zipCode || ""}
              onChange={(e) => setCurrentZip(e.target.value.replace(/\D/g, "").slice(0, 5), filters.radiusMiles)}
              maxLength={5}
              inputMode="numeric"
              className="w-14 text-sm font-medium text-foreground bg-transparent border-none outline-none" />
              <span className="text-xs text-muted-foreground">Distance:</span>
              <select
              value={filters.radiusMiles}
              onChange={(e) => setCurrentZip(filters.zipCode, Number(e.target.value))}
              className="text-sm font-medium text-foreground bg-transparent border-none outline-none cursor-pointer">
                {[5, 10, 15, 25, 50, 100].map((d) =>
              <option key={d} value={d}>{d} mi</option>
              )}
              </select>
            </div>
          }
            <button
            onClick={() => setCurrentZip(sessionDefaultZip || "", 15)}
            className="text-xs text-muted-foreground underline hover:text-foreground">
              Clear
            </button>
          </div>
        }
      </div>

      {/* Org filter banner */}
      {orgFilter && (
        <div className="mb-4 flex items-center gap-2 bg-mint-50 border border-mint-200 rounded-xl px-4 py-2.5">
          <span className="text-sm text-mint-700 font-medium flex-1">
            Showing activities for: <strong>{orgFilter}</strong>
          </span>
          <button
            onClick={() => { setOrgFilter(""); window.history.replaceState(null, "", "/"); }}
            className="text-mint-500 hover:text-mint-700 transition-colors"
            title="Clear organizer filter"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <EventFilters filters={filters} onFiltersChange={setFilters} detectedZip={detectedZip} user={user} defaultZip={sessionDefaultZip} expanded={expandFilters} onExpandedChange={setExpandFilters} />

      {/* Results */}
      <div className="mt-6">
        {loading ?
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
          </div> :
        filteredEvents.length === 0 ?
        <div>
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-mint-50 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-mint-300" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-1">No Activities Found</h3>
            <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or check back soon.</p>
            <Button variant="outline" className="rounded-xl" onClick={() => setFilters({ search: "", category: "all", activeStatus: "active", sortBy: "posted", zipCode: "", radiusMiles: 15, ageMin: "", ageMax: "", priceMin: "", priceMax: "", freeOnly: false, dateFrom: moment().toDate(), dateTo: moment().add(120, "days").toDate(), savedOnly: false, favOrgsOnly: false })}>
              Clear All Filters
            </Button>
          </div>
          {activeAds.length > 0 && (
            <AdInjectedFeed events={[]} ads={activeAds} rotationIndex={adRotationIndex} zipCode={filters.zipCode} savedEventIds={savedEventIds} onToggleSave={toggleSave} user={user} />
          )}

        </div> :

        <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{filteredEvents.length}</strong> activit{filteredEvents.length !== 1 ? "ies" : "y"} found
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Activities submitted by the <span className="font-bold text-mint-500">Organizer</span> are highlighted with a green border and may have a photo and logo. Activities submitted by a <span className="font-bold">Community Member</span> have a grey border. A few <span className="text-peach-500 font-medium">Supporter</span> ads connect you to businesses supporting local kids.
                </p>
              </div>
            </div>
            <AdInjectedFeed events={filteredEvents} ads={activeAds} rotationIndex={adRotationIndex} zipCode={filters.zipCode} savedEventIds={savedEventIds} onToggleSave={toggleSave} user={user} />
          </>
        }
      </div>
    </div>);

}