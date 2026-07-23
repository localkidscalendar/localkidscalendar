import React from "react";

/**
 * Default/filler ad — same creative frame as paid ads (h-48 + black bar).
 * Images use object-cover: fill the frame, crop overflow (keep subject centered).
 */
export default function DefaultAdCard({ ad }) {
  return (
    <a
      href={ad.link_url}
      className="group block rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 animate-settle bg-white border-2 border-transparent"
    >
      <div className="h-48 overflow-hidden">
        {ad.image_url ? (
          <img
            src={ad.image_url}
            alt={ad.ad_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-mint-50 to-peach-50 flex items-center justify-center px-4 text-center">
            <span className="font-heading font-bold text-lg text-mint-600">{ad.ad_name}</span>
          </div>
        )}
      </div>
      {/* Height-matched bar so filler cards align with paid ads (zip / flag / link footer) */}
      <div className="bg-black/90 backdrop-blur-sm px-3 py-1.5">
        <span className="text-xs text-gray-300">Community</span>
      </div>
    </a>
  );
}
