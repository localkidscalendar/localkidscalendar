import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export default function AdminAdRatesPanel({ toast }) {
  const [pricing, setPricing] = useState(null);
  const [monthly, setMonthly] = useState("150");
  const [annual, setAnnual] = useState("30");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("ad_pricing_config").select("*").eq("config_key", "global").maybeSingle();
      if (data) {
        setPricing(data);
        setMonthly(String(data.monthly_rate));
        setAnnual(String(data.annual_discount_percent));
      }
      setLoading(false);
    };
    load();
  }, []);

  const save = async () => {
    if (!pricing?.id) return;
    setSaving(true);
    const { error } = await supabase.from("ad_pricing_config").update({
      monthly_rate: Number(monthly),
      annual_discount_percent: Number(annual),
      updated_at: new Date().toISOString(),
    }).eq("id", pricing.id);
    if (error) toast?.({ title: "Failed", description: error.message, variant: "destructive" });
    else toast?.({ title: "Rates updated" });
    setSaving(false);
  };

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-mint-500" />;

  return (
    <div className="space-y-3 max-w-sm">
      <p className="text-xs text-muted-foreground">Displayed rates for Supporters (billing still waived in beta).</p>
      <div>
        <label className="text-sm font-medium">Monthly rate ($)</label>
        <Input className="rounded-xl mt-1" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium">Annual discount (%)</label>
        <Input className="rounded-xl mt-1" value={annual} onChange={(e) => setAnnual(e.target.value)} />
      </div>
      <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" disabled={saving} onClick={save}>
        Save rates
      </Button>
    </div>
  );
}
