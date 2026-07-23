import React from "react";
import { Button } from "@/components/ui/button";
import { Images } from "lucide-react";

/**
 * Soft-landed for private beta while ads/Stripe move off Base44.
 * Full Ad Manager implementation remains in git history for the ads migration.
 */
export default function AdManager() {
  return (
    <div className="max-w-lg mx-auto mt-16 mb-20 text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-peach-50 flex items-center justify-center mx-auto mb-4">
        <Images className="w-7 h-7 text-peach-500" />
      </div>
      <h1 className="font-heading font-bold text-2xl mb-3">Ad Manager</h1>
      <p className="text-muted-foreground mb-2 leading-relaxed">
        Supporter advertising and checkout are paused during our private beta while we finish payments and ad tools on the new platform.
      </p>
      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Rules, tips, and invite tools still work. Contact us if you want to be notified when ads open.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => { window.location.href = "/contact"; }}>
          Contact us
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={() => { window.location.href = "/supporters"; }}>
          Back to Supporters
        </Button>
        <Button variant="outline" className="rounded-xl" onClick={() => { window.location.href = "/tips-supporters"; }}>
          Tips for Supporters
        </Button>
      </div>
    </div>
  );
}
