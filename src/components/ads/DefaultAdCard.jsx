import React from "react";
import {
  SUPPORTER_AD_FOOTER_LAYOUT_CLASS,
  SUPPORTER_AD_IMAGE_FRAME_CLASS,
} from "@/lib/supporterAdDisplay.js";

/** Invisible copy of the Supporter footer row — establishes the same height without the black bar. */
function SupporterFooterHeightSizer() {
  return (
    <div className={`${SUPPORTER_AD_FOOTER_LAYOUT_CLASS} invisible`} aria-hidden="true">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold">&nbsp;</span>
        <span className="text-xs">&nbsp;</span>
      </div>
      <span className="w-3.5 h-3.5 shrink-0" />
    </div>
  );
}

/**
 * Default/filler ad — full photo (no footer bar).
 * Uses the same outer height as SupporterAdCard (3:2 creative + footer row).
 */
export default function DefaultAdCard({ ad }) {
  return (
    <a
      href={ad.link_url}
      className="group block rounded-2xl border-2 border-black overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-black/15 hover:-translate-y-0.5 animate-settle bg-white relative"
    >
      <div className={`${SUPPORTER_AD_IMAGE_FRAME_CLASS} shrink-0`} aria-hidden="true" />
      <SupporterFooterHeightSizer />
      {ad.image_url ? (
        <img
          src={ad.image_url}
          alt={ad.ad_name}
          className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-mint-50 to-peach-50 flex items-center justify-center px-4 text-center">
          <span className="font-heading font-bold text-lg text-mint-600">{ad.ad_name}</span>
        </div>
      )}
    </a>
  );
}
