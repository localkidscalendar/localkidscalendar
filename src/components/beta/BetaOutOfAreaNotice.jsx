// BETA MODE — temporary notice when Home/session zip is outside Stage 2 whitelist
import React from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Highly visible Home notice: profile may keep any real zip, but the session
 * location filter is outside the beta area so activities won't list.
 */
export default function BetaOutOfAreaNotice({ zip, betaZips = [], onSelectZip }) {
  const sorted = [...betaZips].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true })
  );

  return (
    <div
      className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 sm:p-5 text-left shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-200/80 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-800" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="font-heading font-bold text-base sm:text-lg text-amber-950">
            {zip ? `Zip ${zip} isn’t in the beta area` : "This zip isn’t in the beta area"}
          </h2>
          <p className="text-sm text-amber-900/90 leading-relaxed">
            During beta, activities and Supporter ads are only listed for certain zip codes.
            Your profile can keep your real home zip — but with this Home location filter,
            <strong className="font-semibold"> you won’t see matching activities</strong> until
            you pick a beta area below (or you can keep browsing knowing the list will stay empty).
          </p>
          {sorted.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                Switch this session’s Home zip to a beta area:
              </p>
              <div className="flex flex-wrap gap-2">
                {sorted.map((z) => (
                  <Button
                    key={z}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full h-8 text-xs border-amber-300 bg-white hover:bg-amber-100 text-amber-950"
                    onClick={() => onSelectZip?.(z)}
                  >
                    {z}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-amber-800/80 mt-2">
                This only changes your Home filter for this browser session — it does not change your profile zip.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
