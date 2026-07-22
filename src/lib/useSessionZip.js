import { useState, useEffect } from "react";
import useGeoLocation from "@/lib/useGeoLocation";

// Resolves the session's active zip code the same way Home.jsx does:
// signed-in users use their profile zip; signed-out users keep an in-session
// selection if one is already set, otherwise fall back to geolocation.
// `resolved` becomes true once a determination has been made (even if the
// zip turned out to be empty, e.g. geolocation was declined) — callers can
// use that to know when to prompt for manual entry.
export default function useSessionZip(user, userLoading) {
  const geo = useGeoLocation();
  const [zip, setZip] = useState(() => {
    try { return sessionStorage.getItem("session_zip_current") || ""; } catch { return ""; }
  });
  const [resolved, setResolved] = useState(() => {
    try { return !!sessionStorage.getItem("session_zip_current"); } catch { return false; }
  });

  const setCurrentZip = (newZip, radius = 15) => {
    setZip(newZip);
    setResolved(true);
    try {
      sessionStorage.setItem("session_zip_current", newZip);
      sessionStorage.setItem("session_radius", String(radius));
    } catch {}
  };

  useEffect(() => {
    if (resolved || userLoading) return;
    if (user) {
      setCurrentZip(user.zip_code || "");
      return;
    }
    if (!geo.loading) {
      setCurrentZip(geo.zip || "");
    }
  }, [user, userLoading, geo.loading, geo.zip, resolved]);

  return { zip, resolved, setCurrentZip };
}