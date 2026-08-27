// BETA MODE — temporary banner, safe to remove along with useBetaConfig.js and AdminBetaPanel.jsx
import React, { useState } from "react";
import { Link } from "react-router-dom";
import useBetaConfig, { betaZipsForDisplay } from "@/lib/useBetaConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function BetaBanner() {
  const { enabled, zip_codes, loading } = useBetaConfig();
  const displayZips = betaZipsForDisplay(zip_codes);
  const [open, setOpen] = useState(false);

  if (loading || !enabled) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* z-index above sticky navbar so the control stays tappable on mobile */}
      <div className="relative z-[60] bg-orange-500 text-white text-center text-xs sm:text-sm py-2 px-4">
        This site is in Beta mode in limited{" "}
        <DialogTrigger asChild>
          <button
            type="button"
            className="underline font-semibold hover:opacity-90 inline-block px-0.5 py-1 -my-1 touch-manipulation"
          >
            locations
          </button>
        </DialogTrigger>
        .{" "}
        <Link to="/contact" className="underline font-semibold hover:opacity-90">
          Send us your feedback!
        </Link>
      </div>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">Available Beta Zip Codes</DialogTitle>
        </DialogHeader>
        {displayZips.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Available beta areas are limited. Contact us if you need help finding activities near you.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {displayZips.map((z) => (
              <span key={z} className="px-3 py-1 rounded-full bg-mint-50 text-mint-600 text-sm font-medium">{z}</span>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
