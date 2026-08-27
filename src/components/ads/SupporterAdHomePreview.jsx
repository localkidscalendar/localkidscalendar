import React from "react";
import { ExternalLink } from "lucide-react";

/**
 * Static frame matching SupporterAdCard on Home (h-48 creative + black footer).
 * Use in Ad Manager so supporters see exact crop and border before paying.
 */
export default function SupporterAdHomePreview({
  imageUrl,
  zipCode = "12345",
  className = "",
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-black bg-white overflow-hidden flex flex-col shadow-sm ${className}`}
      aria-label="Homepage ad preview"
    >
      <div className="h-48 overflow-hidden bg-muted pointer-events-none">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-peach-50 to-peach-100 flex items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>
      <div className="bg-black/90 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-white">{zipCode || "—"}</span>
          <span className="text-xs text-gray-300">Supporter</span>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}
