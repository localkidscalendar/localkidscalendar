import React from "react";
import {
  SUPPORTER_AD_FOOTER_LAYOUT_CLASS,
  SUPPORTER_AD_IMAGE_FRAME_CLASS,
} from "@/lib/supporterAdDisplay.js";

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
 * Static frame matching DefaultAdCard on Home (same total height as Supporter ads, no footer bar).
 */
export default function DefaultAdHomePreview({ imageUrl, className = "" }) {
  return (
    <div
      className={`rounded-2xl border-2 border-black bg-white overflow-hidden relative flex flex-col shadow-sm ${className}`}
      aria-label="Homepage default ad preview"
    >
      <div className={`${SUPPORTER_AD_IMAGE_FRAME_CLASS} shrink-0`} aria-hidden="true" />
      <SupporterFooterHeightSizer />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-mint-50 to-peach-50 flex items-center justify-center text-xs text-muted-foreground pointer-events-none">
          No image
        </div>
      )}
    </div>
  );
}
