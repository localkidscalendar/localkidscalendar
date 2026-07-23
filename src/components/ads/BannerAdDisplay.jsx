import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import SupporterAdCard from "@/components/ads/SupporterAdCard";
import DefaultAdCard from "@/components/ads/DefaultAdCard";
import useSessionZip from "@/lib/useSessionZip";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Bottom-of-page supporter ads on all routes except Home and Supporters. */
export default function BannerAdDisplay({ user, userLoading }) {
  const { zip: userZip, resolved } = useSessionZip(user, userLoading);
  const [displayAds, setDisplayAds] = useState([]);

  useEffect(() => {
    if (!resolved) return;
    let cancelled = false;

    const load = async () => {
      try {
        let paidAds = [];
        if (userZip) {
          const { data, error } = await supabase
            .from("banner_ads")
            .select("*")
            .eq("status", "active")
            .eq("zip_code", userZip)
            .order("created_at", { ascending: false })
            .limit(20);
          if (error) throw error;
          paidAds = data || [];

          // Fire-and-forget impression bumps (best-effort)
          paidAds.forEach((ad) => {
            supabase
              .from("banner_ads")
              .update({ impressions: (ad.impressions || 0) + 1 })
              .eq("id", ad.id)
              .then(() => {})
              .catch(() => {});
          });
        }

        let maxSlots = 3;
        if (userZip) {
          const { data: zipConfig } = await supabase
            .from("ad_zip_config")
            .select("max_slots")
            .eq("zip_code", userZip)
            .maybeSingle();
          if (zipConfig?.max_slots) maxSlots = Number(zipConfig.max_slots) || 3;
        }

        const emptySlots = Math.max(0, maxSlots - paidAds.length);
        // Default/filler ads table not migrated yet — show paid only for beta.
        const fillerAds = [];
        void emptySlots;
        void fillerAds;

        const combined = [
          ...paidAds.map((ad) => ({ type: "paid", ad })),
          ...fillerAds.map((ad) => ({ type: "default", ad })),
        ];

        if (!cancelled) setDisplayAds(shuffle(combined));
      } catch {
        if (!cancelled) setDisplayAds([]);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [userZip, resolved]);

  if (!displayAds.length) return null;

  return (
    <div className="w-full bg-muted/30 border-t border-border py-4 px-4">
      <p className="text-xs text-center text-muted-foreground mb-3 font-medium">✦ Community Supporters</p>
      <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
        {displayAds.map(({ type, ad }, i) =>
          type === "paid"
            ? <SupporterAdCard key={ad.id} ad={ad} user={user} />
            : <DefaultAdCard key={`default-${ad.id}-${i}`} ad={ad} />
        )}
      </div>
    </div>
  );
}
