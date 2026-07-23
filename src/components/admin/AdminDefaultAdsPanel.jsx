import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Trash2, ExternalLink, Plus, Star } from "lucide-react";

const SLOT_LABELS = { is_slot_1: "Ad 1", is_slot_2: "Ad 2", is_slot_3: "Ad 3" };

export default function AdminDefaultAdsPanel({ toast }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ad_name: "", image_url: "", link_url: "", status: "active" });

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data: items, error } = await supabase
        .from("admin_default_ads")
        .select("*")
        .order("priority", { ascending: false })
        .limit(50);
      if (error) throw error;
      setAds(items || []);
    } catch {
      setAds([]);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/default-ad-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("event-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("event-media").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: publicData.publicUrl }));
    } catch (err) {
      toast?.({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const handleCreate = async () => {
    if (!form.ad_name || !form.link_url) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("admin_default_ads").insert({
        ad_name: form.ad_name,
        image_url: form.image_url || null,
        link_url: form.link_url,
        status: "active",
        priority: 0,
        is_slot_1: false,
        is_slot_2: false,
        is_slot_3: false,
      });
      if (error) throw error;
      toast?.({ title: "Default ad created" });
      setForm({ ad_name: "", image_url: "", link_url: "", status: "active" });
      setShowForm(false);
      load();
    } catch {
      toast?.({ title: "Failed to create ad", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleToggleSlot = async (ad, slot) => {
    const currentHolder = ads.find((a) => a[slot] && a.id !== ad.id);
    if (currentHolder) {
      const { error: unassignError } = await supabase
        .from("admin_default_ads")
        .update({ [slot]: false, updated_at: new Date().toISOString() })
        .eq("id", currentHolder.id);
      if (unassignError) {
        toast?.({ title: "Failed to update slot", variant: "destructive" });
        return;
      }
    }
    const newVal = !ad[slot];
    const { error } = await supabase
      .from("admin_default_ads")
      .update({ [slot]: newVal, updated_at: new Date().toISOString() })
      .eq("id", ad.id);
    if (error) {
      toast?.({ title: "Failed to update slot", variant: "destructive" });
      return;
    }
    toast?.({ title: newVal ? `${SLOT_LABELS[slot]} assigned to "${ad.ad_name}"` : `${SLOT_LABELS[slot]} unassigned` });
    load();
  };

  const handleToggleStatus = async (ad) => {
    const newStatus = ad.status === "active" ? "inactive" : "active";
    const { error } = await supabase.from("admin_default_ads").update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", ad.id);
    if (error) {
      toast?.({ title: "Failed to update status", variant: "destructive" });
      return;
    }
    setAds((prev) => prev.map((a) => (a.id === ad.id ? { ...a, status: newStatus } : a)));
    toast?.({ title: `Ad ${newStatus === "active" ? "activated" : "deactivated"}` });
  };

  const handleDelete = async (ad) => {
    if (!window.confirm(`Delete "${ad.ad_name}"?`)) return;
    const { error } = await supabase.from("admin_default_ads").delete().eq("id", ad.id);
    if (error) {
      toast?.({ title: "Failed to delete ad", variant: "destructive" });
      return;
    }
    setAds((prev) => prev.filter((a) => a.id !== ad.id));
    toast?.({ title: "Default ad deleted" });
  };

  const slot1 = ads.find((a) => a.is_slot_1);
  const slot2 = ads.find((a) => a.is_slot_2);
  const slot3 = ads.find((a) => a.is_slot_3);

  return (
    <div className="bg-white border border-border rounded-2xl p-5 space-y-5">
      <div>
        <h3 className="font-heading font-semibold text-sm mb-2 flex items-center gap-2">
          <Star className="w-4 h-4 text-muted-foreground" /> Default Ad Slot Assignments
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          These fill empty advertiser slots. Ad 1 fills the first open slot, Ad 2 the second, Ad 3 the third. They never displace paid ads.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Ad 1", ad: slot1, slot: "is_slot_1" },
            { label: "Ad 2", ad: slot2, slot: "is_slot_2" },
            { label: "Ad 3", ad: slot3, slot: "is_slot_3" },
          ].map(({ label, ad }) => (
            <div key={label} className="bg-muted/30 rounded-xl border border-border p-3 text-center">
              <p className="text-xs font-bold text-muted-foreground mb-1">{label}</p>
              {ad ? (
                <>
                  {ad.image_url && <img src={ad.image_url} alt={ad.ad_name} className="w-full h-10 object-cover rounded-lg mb-1" />}
                  <p className="text-xs font-medium truncate">{ad.ad_name}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${ad.status === "active" ? "bg-mint-100 text-mint-600" : "bg-gray-100 text-gray-500"}`}>{ad.status}</span>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Not assigned</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-5">
        <h3 className="font-heading font-semibold text-sm">All Default/Filler Ads ({ads.length})</h3>
        {!showForm && (
          <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Default/Filler Ad
          </Button>
        )}
      </div>

      {showForm && (
        <div className="bg-muted/40 rounded-2xl border border-border p-4 space-y-3">
          <div>
            <Label>Ad Name *</Label>
            <Input className="mt-1" placeholder="Promote Advertising" value={form.ad_name} onChange={(e) => setForm((f) => ({ ...f, ad_name: e.target.value }))} />
          </div>
          <div>
            <Label>Ad Image</Label>
            <p className="text-xs text-muted-foreground mt-0.5 mb-1">Recommended size: 600 × 700 px (6:7 ratio), JPG or PNG, under 2 MB.</p>
            <div className="mt-1 flex items-center gap-3 flex-wrap">
              {form.image_url
                ? <img src={form.image_url} alt="Preview" className="h-16 rounded-lg object-cover border border-border" />
                : <div className="h-16 w-32 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border">No image</div>
              }
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  {uploading ? "Uploading…" : "Upload Image"}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            <Input
              className="mt-2"
              placeholder="Or paste image URL…"
              value={form.image_url}
              onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
            />
          </div>
          <div>
            <Label>Destination URL *</Label>
            <Input className="mt-1" placeholder="/supporters" value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => { setShowForm(false); setForm({ ad_name: "", image_url: "", link_url: "" }); }}>Cancel</Button>
            <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" disabled={!form.ad_name || !form.link_url || saving} onClick={handleCreate}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Create Ad"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-mint-500" /></div>
      ) : ads.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No default ads yet.</p>
      ) : (
        <div className="space-y-3">
          {ads.map((ad) => {
            const assignedSlots = Object.entries(SLOT_LABELS).filter(([slot]) => ad[slot]).map(([, label]) => label);
            return (
              <div key={ad.id} className="bg-muted/20 rounded-2xl border border-border p-4">
                <div className="flex items-start gap-4">
                  {ad.image_url && (
                    <img src={ad.image_url} alt={ad.ad_name} className="w-24 h-14 object-cover rounded-xl border border-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <p className="font-medium text-sm">{ad.ad_name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ad.status === "active" ? "bg-mint-100 text-mint-600" : "bg-gray-100 text-gray-500"}`}>
                        {ad.status}
                      </span>
                      {assignedSlots.map((s) => (
                        <span key={s} className="px-2 py-0.5 rounded-full text-xs font-bold bg-peach-100 text-peach-600">{s}</span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {Object.entries(SLOT_LABELS).map(([slot, label]) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => handleToggleSlot(ad, slot)}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-all ${ad[slot] ? "bg-peach-100 border-peach-300 text-peach-700" : "bg-muted border-border text-muted-foreground hover:border-peach-200"}`}
                        >
                          {ad[slot] ? `✓ ${label}` : `+ ${label}`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {ad.link_url && (
                      <a href={ad.link_url.startsWith("http") ? ad.link_url : `${window.location.origin}${ad.link_url}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                      </a>
                    )}
                    <Button variant="ghost" size="sm" className={`h-7 text-xs rounded-xl ${ad.status === "active" ? "text-muted-foreground" : "text-mint-500"}`} onClick={() => handleToggleStatus(ad)}>
                      {ad.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(ad)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
