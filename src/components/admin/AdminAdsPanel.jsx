import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";

export default function AdminAdsPanel({ ads = [], onRefresh, toast }) {
  const [zipConfigs, setZipConfigs] = useState([]);
  const [newZip, setNewZip] = useState("");
  const [newSlots, setNewSlots] = useState("3");
  const [loadingExtras, setLoadingExtras] = useState(true);

  useEffect(() => {
    loadExtras();
  }, []);

  const loadExtras = async () => {
    setLoadingExtras(true);
    try {
      const { data: configs } = await supabase.from("ad_zip_config").select("*").order("zip_code").limit(100);
      setZipConfigs(configs || []);
    } catch {
      setZipConfigs([]);
    }
    setLoadingExtras(false);
  };

  const setAdStatus = async (ad, status, notes = "") => {
    const updates = {
      status,
      moderation_status: status === "active" ? "approved" : status === "rejected" ? "rejected" : ad.moderation_status,
      moderation_notes: notes,
      updated_at: new Date().toISOString(),
    };
    if (status === "active") {
      const start = new Date();
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      updates.plan_start_date = start.toISOString().slice(0, 10);
      updates.plan_end_date = end.toISOString().slice(0, 10);
      updates.next_renewal_date = end.toISOString().slice(0, 10);
    }
    const { error } = await supabase.from("banner_ads").update(updates).eq("id", ad.id);
    if (error) {
      toast?.({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    if (status === "active") {
      await supabase.from("profiles").update({ is_advertiser: true }).eq("id", ad.user_id);
    }
    toast?.({ title: `Ad marked ${status}` });
    onRefresh?.();
  };

  const addZipConfig = async () => {
    const zip = newZip.trim();
    const slots = Number(newSlots) || 3;
    if (zip.length !== 5) return;
    const { error } = await supabase.from("ad_zip_config").upsert({
      zip_code: zip,
      max_slots: slots,
      updated_at: new Date().toISOString(),
    }, { onConflict: "zip_code" });
    if (error) {
      toast?.({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    setNewZip("");
    setNewSlots("3");
    loadExtras();
    toast?.({ title: "Zip slot config saved" });
  };

  const pendingAds = ads.filter((a) => a.status === "pending_review");
  const activeAds = ads.filter((a) => a.status === "active");
  const otherAds = ads.filter((a) => !["pending_review", "active"].includes(a.status));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="font-heading font-semibold text-sm">Pending placements</h3>
        <p className="text-xs text-muted-foreground -mt-2">
          Zip placement requests after an approved creative. Creative image review is handled above under Advertising Photo Manual Review (only when requested).
        </p>
        {pendingAds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No placement requests.</p>
        ) : (
          pendingAds.map((ad) => (
            <div key={ad.id} className="flex gap-3 p-3 bg-white rounded-xl border border-border">
              <img src={ad.image_url} alt={ad.business_name} className="w-16 h-16 rounded-lg object-cover border" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{ad.business_name}</p>
                <p className="text-xs text-muted-foreground">Zip {ad.zip_code}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="rounded-lg text-xs h-7 bg-mint-500 hover:bg-mint-600 text-white" onClick={() => setAdStatus(ad, "active")}>
                  Activate
                </Button>
                <Button size="sm" variant="outline" className="rounded-lg text-xs h-7 text-destructive" onClick={() => {
                  const notes = window.prompt("Rejection notes:") || "Rejected";
                  setAdStatus(ad, "rejected", notes);
                }}>
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-heading font-semibold text-sm">Active ads ({activeAds.length})</h3>
        {activeAds.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active ads.</p>
        ) : (
          activeAds.map((ad) => (
            <div key={ad.id} className="flex gap-3 p-3 bg-white rounded-xl border border-border">
              <img src={ad.image_url} alt={ad.business_name} className="w-16 h-16 rounded-lg object-cover border" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{ad.business_name}</p>
                <p className="text-xs text-muted-foreground">Zip {ad.zip_code} · {ad.clicks || 0} clicks</p>
              </div>
              <Button size="sm" variant="outline" className="rounded-lg text-xs h-7" onClick={() => setAdStatus(ad, "cancelled", "Paused by admin")}>
                Deactivate
              </Button>
            </div>
          ))
        )}
      </section>

      {otherAds.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-heading font-semibold text-sm">Other ({otherAds.length})</h3>
          {otherAds.map((ad) => (
            <div key={ad.id} className="flex gap-3 p-3 bg-white rounded-xl border border-border text-sm">
              <img src={ad.image_url} alt="" className="w-12 h-12 rounded object-cover border" />
              <div className="flex-1">
                <p className="font-medium">{ad.business_name}</p>
                <p className="text-xs text-muted-foreground">{ad.status} · zip {ad.zip_code}</p>
              </div>
              {ad.status !== "active" && (
                <Button size="sm" variant="outline" className="rounded-lg text-xs h-7" onClick={() => setAdStatus(ad, "active")}>
                  Reactivate
                </Button>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-heading font-semibold text-sm">Zip slot limits</h3>
        {loadingExtras ? (
          <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
        ) : (
          <>
            <div className="flex gap-2">
              <Input className="rounded-xl max-w-[120px]" placeholder="Zip" maxLength={5} value={newZip} onChange={(e) => setNewZip(e.target.value.replace(/\D/g, "").slice(0, 5))} />
              <Input className="rounded-xl max-w-[80px]" placeholder="Slots" value={newSlots} onChange={(e) => setNewSlots(e.target.value.replace(/\D/g, "").slice(0, 2))} />
              <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={addZipConfig}>
                <Plus className="w-4 h-4 mr-1" /> Save
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {zipConfigs.map((c) => (
                <span key={c.id} className="px-3 py-1 rounded-full bg-muted text-xs font-medium">
                  {c.zip_code}: {c.max_slots} slots
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Default is 3 slots per zip when no override is set.</p>
          </>
        )}
      </section>
    </div>
  );
}
