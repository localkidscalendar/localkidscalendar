import { useState, useEffect } from "react";

export default function useGeoLocation() {
  const [location, setLocation] = useState({ lat: null, lng: null, zip: "", loading: true });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation((prev) => ({ ...prev, loading: false }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`);
          const data = await res.json();
          const zip = data?.address?.postcode || "";
          setLocation({ lat: latitude, lng: longitude, zip, loading: false });
        } catch {
          setLocation({ lat: latitude, lng: longitude, zip: "", loading: false });
        }
      },
      () => setLocation((prev) => ({ ...prev, loading: false })),
      { timeout: 8000 }
    );
  }, []);

  return location;
}