import React from "react";

/** Default/filler ad — h-56 matches paid SupporterAdCard (h-48 creative + black footer). */
export default function DefaultAdCard({ ad }) {
  return (
    <a
      href={ad.link_url}
      className="group block rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 animate-settle bg-white"
    >
      <div className="h-56 bg-muted/30 overflow-hidden flex items-center justify-center">
        {ad.image_url ? (
          <img
            src={ad.image_url}
            alt={ad.ad_name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-mint-50 to-peach-50 flex items-center justify-center px-4 text-center">
            <span className="font-heading font-bold text-lg text-mint-600">{ad.ad_name}</span>
          </div>
        )}
      </div>
    </a>
  );
}
