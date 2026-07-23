import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

export default function CurrentAdRates() {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("ad_pricing_config")
          .select("*")
          .eq("config_key", "global")
          .maybeSingle();
        setPricing(data || { monthly_rate: 150, annual_discount_percent: 30 });
      } catch {
        setPricing({ monthly_rate: 150, annual_discount_percent: 30 });
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  if (!pricing) return null;

  const monthly = Number(pricing.monthly_rate) || 150;
  const discount = Number(pricing.annual_discount_percent) || 30;
  const annualPrice = Math.round(monthly * 12 * (1 - discount / 100));
  const annualMonthly = (annualPrice / 12).toFixed(2);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-4">
        These are the published rates Supporters will pay when billing launches after beta. During beta, placement is waived.
      </p>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-muted/30 rounded-xl p-4 text-center">
          <p className="font-heading font-bold text-2xl">${monthly}</p>
          <p className="text-xs text-muted-foreground font-medium">per month / per zip code</p>
        </div>
        <div className="bg-mint-50 border border-mint-200 rounded-xl p-4 text-center relative">
          <div className="text-xs font-bold text-peach-500 mb-1">⭐ Best Value</div>
          <p className="font-heading font-bold text-2xl">${annualPrice.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground font-medium">per year / per zip code</p>
          <p className="text-xs text-mint-600 mt-1">
            (~${annualMonthly}/mo — save {discount}%)
          </p>
        </div>
      </div>
      <div className="bg-muted/20 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground text-sm mb-2">Renewal Policy</p>
        <p>
          • Plans automatically renew for the same period at the{" "}
          <strong>current ad rate as of 21 days before renewal</strong>.
        </p>
        <p>
          • To avoid renewal, you must cancel at least <strong>14 days before your renewal date</strong>.
        </p>
        <p>• Renewal charges are processed automatically via your payment method on file.</p>
        <p>• Rate changes announced before the 21-day window will apply to your next renewal cycle.</p>
      </div>
    </div>
  );
}
