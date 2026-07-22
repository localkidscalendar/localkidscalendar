import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Building2, Loader2, UserPlus } from "lucide-react";
import AuthPromptModal from "@/components/shared/AuthPromptModal";
import OrganizerCard from "@/components/organizers/OrganizerCard";

// Haversine distance in miles between two lat/lng points
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocodeZip(zip) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (place) return { lat: parseFloat(place.latitude), lng: parseFloat(place.longitude) };
  } catch {}
  return null;
}

export default function Organizers() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteRecords, setFavoriteRecords] = useState([]);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [locationZip, setLocationZip] = useState("");
  const [locationRadius, setLocationRadius] = useState(15);

  useEffect(() => {
    try {
      const zip = sessionStorage.getItem("session_zip_current");
      const radius = sessionStorage.getItem("session_radius");
      if (zip) setLocationZip(zip);
      if (radius) setLocationRadius(Number(radius));
    } catch {}
    loadOrganizers();
    if (user) loadFavorites();
  }, [user]);

  const loadFavorites = async () => {
    try {
      const { data: records, error } = await supabase
        .from("favorite_organizers")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      setFavoriteRecords(records || []);
      setFavoriteIds(new Set((records || []).map((r) => r.organizer_id).filter(Boolean)));
    } catch {}
  };

  const toggleFavorite = async (orgId, posterUserId) => {
    if (!user) return setAuthPrompt(true);
    try {
      if (favoriteIds.has(orgId)) {
        const record = favoriteRecords.find((r) => r.organizer_id === orgId);
        if (record) {
          const { error } = await supabase.from("favorite_organizers").delete().eq("id", record.id);
          if (error) throw error;
          setFavoriteRecords((prev) => prev.filter((r) => r.organizer_id !== orgId));
          setFavoriteIds((prev) => {
            const s = new Set(prev);
            s.delete(orgId);
            return s;
          });
        }
      } else {
        const { data: record, error } = await supabase
          .from("favorite_organizers")
          .insert({
            user_id: user.id,
            organizer_id: orgId,
            poster_user_id: posterUserId || null,
          })
          .select("*")
          .single();
        if (error) throw error;
        setFavoriteRecords((prev) => [...prev, record]);
        setFavoriteIds((prev) => new Set([...prev, orgId]));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadOrganizers = async () => {
    setLoading(true);
    try {
      const [{ data: records, error: orgError }, { data: events, error: eventError }] = await Promise.all([
        supabase.from("organizers").select("*").order("org_name").limit(200),
        supabase.from("events").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(500),
      ]);
      if (orgError) throw orgError;
      if (eventError) throw eventError;

      const zip = (() => {
        try { return sessionStorage.getItem("session_zip_current") || ""; } catch { return ""; }
      })();
      const radius = (() => {
        try { return Number(sessionStorage.getItem("session_radius")) || 15; } catch { return 15; }
      })();

      if (!zip) {
        setOrganizers(records || []);
        setLoading(false);
        return;
      }

      const filterCenter = await geocodeZip(zip);
      const uniqueEventZips = [...new Set((events || []).map((e) => e.zip_code).filter((z) => z && z.length >= 5))];
      const eventZipCoords = {};
      await Promise.all(uniqueEventZips.map(async (z) => {
        const coords = await geocodeZip(z);
        if (coords) eventZipCoords[z] = coords;
      }));

      const nearbyOrganizerIds = new Set();
      (events || []).forEach((e) => {
        if (!e.created_by_id) return;
        let inRange = false;
        if (filterCenter) {
          const coords = (e.latitude && e.longitude) ? { lat: e.latitude, lng: e.longitude } : eventZipCoords[e.zip_code];
          if (coords) {
            inRange = haversineDistance(filterCenter.lat, filterCenter.lng, coords.lat, coords.lng) <= radius;
          } else {
            inRange = e.zip_code === zip;
          }
        } else {
          inRange = e.zip_code === zip;
        }
        if (inRange) nearbyOrganizerIds.add(e.created_by_id);
      });

      const nearby = (records || []).filter((o) => nearbyOrganizerIds.has(o.user_id));
      // If nobody is nearby yet (common during early testing), still show all organizers.
      setOrganizers(nearby.length > 0 ? nearby : (records || []));
    } catch {
      setOrganizers([]);
    }
    setLoading(false);
  };

  const filtered = organizers.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.org_name || "").toLowerCase().includes(q) || (o.org_description || "").toLowerCase().includes(q);
  });

  return (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
    <AuthPromptModal open={authPrompt} onOpenChange={setAuthPrompt} message="Sign in to favorite organizers and get notified about their activities." />

      {/* Hero */}
      <div className="mb-10">
        <h1 className="font-heading font-bold text-3xl sm:text-4xl mb-4">Our Organizers</h1>
        <p className="text-muted-foreground leading-relaxed">
          Although all Community Members can submit activities, Organizers can more officially share and promote activities (with a photo and logo) beyond their already-established circles and the limited reach of newsletters and email blasts. Organizer posts get highlighted treatment in the feed, helping local programs, teams, recreation centers, and youth event promoters reach new, fresh faces and grow their audience beyond the usual crowd.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button className="rounded-xl bg-mint-200 hover:bg-mint-300 text-mint-600" onClick={() => navigate("/invite-community-member")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite a Community Member
          </Button>
          <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => navigate("/invite-organizer")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite an Organizer
          </Button>
          <Button className="rounded-xl bg-mint-200 hover:bg-mint-300 text-mint-600" onClick={() => navigate("/invite-supporter")}>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite a Supporter
          </Button>
        </div>
      </div>

      {/* Current Organizers */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-peach-500" />
          <h2 className="font-heading font-bold text-xl">
            {locationZip ? `Current Organizers Near ${locationZip}` : "Current Organizers In Your Area"}
          </h2>
        </div>
        {locationZip ? (
          <p className="text-xs text-muted-foreground mb-4">
            Showing Organizers for zip code <strong>{locationZip}</strong>. This matches your <a href="/" className="text-mint-500 hover:underline">activity search area</a>.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mb-4">
            Your zip code is established on the <a href="/" className="text-mint-500 hover:underline">Activities page</a>.
          </p>
        )}

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search organizers..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl w-full" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No organizers found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((org) => (
              <OrganizerCard key={org.id} org={org} isFavorite={favoriteIds.has(org.id)} onToggleFavorite={toggleFavorite} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}