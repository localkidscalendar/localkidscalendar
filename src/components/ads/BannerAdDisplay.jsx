import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import SupporterAdCard from "@/components/ads/SupporterAdCard";
import DefaultAdCard from "@/components/ads/DefaultAdCard";
import useSessionZip from "@/lib/useSessionZip";

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function BannerAdDisplay({ showOnSupportersPage = false, user, userLoading }) {
  const { zip: userZip, resolved } = useSessionZip(user, userLoading);
  const [displayAds, setDisplayAds] = useState([]);

  useEffect(() => {
    if (!resolved) return;
    const load = async () => {
      try {
        // Load paid active ads only (past_due hidden from public)
        const allActive = await base44.entities.BannerAd.filter({ status: "active" }, "-created_date", 50);
        const paidAds = userZip
          ? allActive.filter(a => a.zip_code === userZip)
          : [];

        // Track impressions for paid ads
        paidAds.forEach(ad => {
          base44.entities.BannerAd.update(ad.id, { impressions: (ad.impressions || 0) + 1 });
        });

        // On supporters page: only show paid ads, no default filler
        if (showOnSupportersPage) {
          setDisplayAds(paidAds.map(ad => ({ type: "paid", ad })));
          return;
        }

        // Determine max slots for this zip (default 3)
        let maxSlots = 3;
        if (userZip) {
          try {
            const configs = await base44.entities.AdZipConfig.filter({ zip_code: userZip });
            if (configs.length > 0) maxSlots = configs[0].max_slots;
          } catch {}
        }

        // Build the slots: fill paid ads first, then fill gaps with default ads
        const emptySlots = Math.max(0, maxSlots - paidAds.length);

        let fillerAds = [];
        if (emptySlots > 0) {
          try {
            const defaults = await base44.entities.AdminDefaultAd.filter({ status: "active" }, "-priority", 10);
            // Pick by slot priority: is_slot_1 first, then is_slot_2, then is_slot_3, rest in order
            const slot1 = defaults.find(a => a.is_slot_1);
            const slot2 = defaults.find(a => a.is_slot_2);
            const slot3 = defaults.find(a => a.is_slot_3);
            const ordered = [slot1, slot2, slot3].filter(Boolean);
            // Dedupe (an ad could be unassigned to multiple slots, but we handle unique by id)
            const seen = new Set();
            const unique = ordered.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; });
            fillerAds = unique.slice(0, emptySlots);
          } catch {}
        }

        // Combine: paid ads + filler, then shuffle the whole set for rotation
        const combined = [
          ...paidAds.map(ad => ({ type: "paid", ad })),
          ...fillerAds.map(ad => ({ type: "default", ad })),
        ];

        setDisplayAds(shuffle(combined));
      } catch {}
    };
    load();
  }, [userZip, resolved, showOnSupportersPage]);

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