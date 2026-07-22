// BETA MODE — temporary banner, safe to remove along with useBetaConfig.js and AdminBetaPanel.jsx
import React, { useState } from "react";
import useBetaConfig from "@/lib/useBetaConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function BetaBanner() {
  const { enabled, zip_codes, loading } = useBetaConfig();
  const [open, setOpen] = useState(false);

  if (loading || !enabled) return null;

  return (
    <>
      <div className="bg-orange-500 text-white text-center text-xs sm:text-sm py-2 px-4">
        This site is in Beta mode in limited{" "}
        <button onClick={() => setOpen(true)} className="underline font-semibold hover:opacity-90">
          locations
        </button>.
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Available Beta Zip Codes</DialogTitle>
          </DialogHeader>
          {zip_codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No zip codes have been added yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {zip_codes.map((z) => (
                <span key={z} className="px-3 py-1 rounded-full bg-mint-50 text-mint-600 text-sm font-medium">{z}</span>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}