import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Upload, CheckCircle, XCircle, Clock, AlertCircle, Trash2,
  ExternalLink, Plus, ImageIcon, Pencil, HelpCircle,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import ImagePreviewModal from "@/components/ads/ImagePreviewModal";
import { AD_IMAGE_REVIEW_GUIDELINES } from "@/lib/supporterContent";
import { moderateAdContent } from "@/lib/moderateAdContent";

const MOD_CONFIG = {
  pending: { label: "Reviewing…", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved: { label: "Approved", color: "bg-mint-100 text-mint-600", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-100 text-red-600", icon: XCircle },
  manual_review: { label: "Manual Review Pending", color: "bg-blue-100 text-blue-700", icon: AlertCircle },
  manual_review_declined: { label: "Manual Review Decline", color: "bg-red-100 text-red-700", icon: XCircle },
};

const EMPTY_FORM = { ad_name: "", image_url: "", link_url: "" };
const LIVE_AD_STATUSES = ["active", "pending_payment", "pending_review", "flagged", "past_due"];

const assetKey = (a) => `${a.image_url}|${a.link_url}`;

function normalizeUrl(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export default function AdLibraryManager({ user, onSelectAsset, allowAddNew = false }) {
  const [assets, setAssets] = useState([]);
  const [flaggedKeys, setFlaggedKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [moderating, setModerating] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => { loadAssets(); }, [user?.id]);

  const loadAssets = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [{ data: items, error }, { data: flaggedAds }] = await Promise.all([
        supabase
          .from("ad_library")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("banner_ads")
          .select("image_url, link_url")
          .eq("user_id", user.id)
          .eq("status", "flagged"),
      ]);
      if (error) throw error;
      setAssets(items || []);
      setFlaggedKeys(new Set((flaggedAds || []).map(assetKey)));
    } catch {
      setAssets([]);
    }
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/ad-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("event-media")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from("event-media").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: publicData.publicUrl }));
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    }
    setUploading(false);
  };

  const toastForResult = (result) => {
    if (result.status === "approved") {
      toast({ title: "Asset approved!", description: "Your ad creative is ready to use." });
    } else if (result.status === "declined") {
      toast({
        title: "Asset not approved",
        description: result.reason || "Please update the image or link and try again — or request a manual review.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Asset submitted", description: "It will be reviewed shortly." });
    }
  };

  const runAutomatedReview = async (assetId) => {
    try {
      const result = await moderateAdContent(assetId);
      toastForResult(result);
      return result;
    } catch (err) {
      toast({
        title: "Automated review unavailable",
        description: err.message || "Please try again in a moment.",
        variant: "destructive",
      });
      return { status: "pending", reason: "" };
    }
  };

  const handleSubmit = async () => {
    if (!form.ad_name || !form.image_url || !form.link_url) return;
    setModerating("new");
    try {
      const linkUrl = normalizeUrl(form.link_url);
      const { data: asset, error } = await supabase.from("ad_library").insert({
        user_id: user.id,
        ad_name: form.ad_name.trim(),
        image_url: form.image_url,
        link_url: linkUrl,
        moderation_status: "pending",
        moderation_notes: "",
        moderation_date: new Date().toISOString(),
      }).select("*").single();
      if (error) throw error;

      await runAutomatedReview(asset.id);
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadAssets();
    } catch (err) {
      toast({ title: "Failed to save asset", description: err.message, variant: "destructive" });
    }
    setModerating(null);
  };

  const handleResubmit = async (assetId) => {
    if (!form.ad_name || !form.image_url || !form.link_url) return;
    setModerating(assetId);
    try {
      const linkUrl = normalizeUrl(form.link_url);
      const { error } = await supabase.from("ad_library").update({
        ad_name: form.ad_name.trim(),
        image_url: form.image_url,
        link_url: linkUrl,
        moderation_status: "pending",
        moderation_notes: "",
        moderation_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", assetId);
      if (error) throw error;

      await runAutomatedReview(assetId);
      setEditingId(null);
      setForm(EMPTY_FORM);
      loadAssets();
    } catch (err) {
      toast({ title: "Failed to resubmit asset", description: err.message, variant: "destructive" });
    }
    setModerating(null);
  };

  const handleRequestManual = async (asset) => {
    setModerating(asset.id);
    try {
      const { error } = await supabase.from("ad_library").update({
        moderation_status: "manual_review",
        updated_at: new Date().toISOString(),
      }).eq("id", asset.id);
      if (error) throw error;
      toast({
        title: "Manual review requested",
        description: "Your creative is in the Advertising Manual Review queue. It will stay pending in your library until an admin decides.",
      });
      loadAssets();
    } catch (err) {
      toast({ title: "Failed to request manual review", description: err.message, variant: "destructive" });
    }
    setModerating(null);
  };

  const handleDelete = async (asset) => {
    const { data: liveAds } = await supabase
      .from("banner_ads")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("image_url", asset.image_url)
      .eq("link_url", asset.link_url);
    const inUse = (liveAds || []).some((ad) => LIVE_AD_STATUSES.includes(ad.status));
    if (inUse) {
      toast({
        title: "Can't delete this asset",
        description: "It's currently being used in a live ad campaign. Remove or replace that campaign's creative first.",
        variant: "destructive",
      });
      return;
    }
    if (!window.confirm("Remove this asset from your library?")) return;
    const { error } = await supabase.from("ad_library").delete().eq("id", asset.id);
    if (error) {
      toast({ title: "Failed to delete", description: error.message, variant: "destructive" });
      return;
    }
    setAssets((a) => a.filter((x) => x.id !== asset.id));
    toast({ title: "Asset removed" });
  };

  const startEdit = (asset) => {
    setEditingId(asset.id);
    setForm({ ad_name: asset.ad_name, image_url: asset.image_url, link_url: asset.link_url });
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-heading font-semibold">Ad Library</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {onSelectAsset
              ? "Select an approved asset below. To add or manage assets, use the Ad Library tab."
              : "Upload creatives for automated review. Approved assets can be used for zip placements. Community flagging catches anything that slips through."}
          </p>
        </div>
        {(!onSelectAsset || allowAddNew) && !showForm && !editingId && (
          <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Asset
          </Button>
        )}
      </div>

      {showForm && (
        <AssetForm
          form={form}
          setForm={setForm}
          uploading={uploading}
          moderating={moderating === "new"}
          onUpload={handleImageUpload}
          onSubmit={handleSubmit}
          onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); }}
          submitLabel="Submit for Review"
        />
      )}

      {assets.length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No assets yet. Add one to get started.</p>
      ) : (
        <div className="space-y-2">
          {assets.map((asset) => {
            const cfg = MOD_CONFIG[asset.moderation_status] || MOD_CONFIG.pending;
            const Icon = cfg.icon;
            const isApproved = asset.moderation_status === "approved";
            const isDeclined = asset.moderation_status === "declined";
            const isManualDeclined = asset.moderation_status === "manual_review_declined";
            const isAnyDeclined = isDeclined || isManualDeclined;
            const isManualPending = asset.moderation_status === "manual_review";
            const isEditing = editingId === asset.id;
            const isFlaggedInUse = flaggedKeys.has(assetKey(asset));
            const isSelectable = isApproved && !isFlaggedInUse;

            return (
              <div key={asset.id} className="rounded-2xl border bg-white overflow-hidden">
                <div
                  className={`flex items-center gap-3 p-3 ${onSelectAsset && isSelectable ? "cursor-pointer hover:border-mint-300" : ""}`}
                  onClick={() => onSelectAsset && isSelectable && onSelectAsset(asset)}
                >
                  {asset.image_url && (
                    <img src={asset.image_url} alt={asset.ad_name} className="w-20 aspect-[3/2] object-cover rounded-lg border border-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{asset.ad_name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                      {isFlaggedInUse && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-peach-100 text-peach-600">
                          <AlertCircle className="w-3 h-3" />Flagged — Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {onSelectAsset && isSelectable && (
                      <Button size="sm" className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white" onClick={() => onSelectAsset(asset)}>
                        Use
                      </Button>
                    )}
                    {asset.image_url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View image" onClick={() => setPreviewImage(asset.image_url)}>
                        <ImageIcon className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <a href={asset.link_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Open destination URL">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    {!onSelectAsset && (isAnyDeclined || asset.moderation_status === "pending") && !isEditing && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Edit & resubmit" onClick={() => startEdit(asset)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {!onSelectAsset && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(asset)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {isFlaggedInUse && (
                  <div className="px-3 pb-3">
                    <div className="bg-peach-50 border border-peach-100 rounded-xl p-3 text-xs text-peach-700">
                      This creative is currently in use by a flagged ad and can't be reused until that ad is resolved.
                    </div>
                  </div>
                )}

                {!onSelectAsset && asset.moderation_status === "pending" && !isEditing && (
                  <div className="px-3 pb-3">
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800 flex flex-wrap items-center gap-2 justify-between">
                      <span>Automated review didn’t finish. Retry, or edit & resubmit.</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white"
                          disabled={moderating === asset.id}
                          onClick={async () => {
                            setModerating(asset.id);
                            await runAutomatedReview(asset.id);
                            loadAssets();
                            setModerating(null);
                          }}
                        >
                          {moderating === asset.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                          Retry review
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs" onClick={() => startEdit(asset)}>
                          <Pencil className="w-3 h-3 mr-1" /> Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!onSelectAsset && isManualPending && (
                  <div className="px-3 pb-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                      Waiting for an admin manual review. You’ll be able to use this creative once it’s approved.
                      {asset.moderation_notes ? <p className="mt-1 text-blue-600/80">Prior note: {asset.moderation_notes}</p> : null}
                    </div>
                  </div>
                )}

                {!onSelectAsset && asset.moderation_notes && isAnyDeclined && !isEditing && (
                  <div className="px-3 pb-3">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 leading-relaxed">
                      <p className="font-semibold mb-1">Decline reason:</p>
                      <p>{asset.moderation_notes}</p>
                      <p className="mt-2 text-red-600/80">Update the asset and resubmit, or request a manual review if you believe this was declined in error.</p>
                      {isDeclined && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs border-red-200 hover:bg-red-100" onClick={() => startEdit(asset)}>
                            <Pencil className="w-3 h-3 mr-1" /> Edit & Resubmit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-xl h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                            disabled={moderating === asset.id}
                            onClick={() => handleRequestManual(asset)}
                          >
                            {moderating === asset.id
                              ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                              : <HelpCircle className="w-3 h-3 mr-1" />}
                            Request Manual Review
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isEditing && (
                  <div className="px-3 pb-3">
                    <AssetForm
                      form={form}
                      setForm={setForm}
                      uploading={uploading}
                      moderating={moderating === asset.id}
                      onUpload={handleImageUpload}
                      onSubmit={() => handleResubmit(asset.id)}
                      onCancel={cancelEdit}
                      submitLabel="Resubmit for Review"
                      note="Update the fields that caused the decline, then resubmit for automated review."
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ImagePreviewModal imageUrl={previewImage} onOpenChange={setPreviewImage} />
    </div>
  );
}

function AssetForm({ form, setForm, uploading, moderating, onUpload, onSubmit, onCancel, submitLabel, note }) {
  return (
    <div className="bg-muted/40 rounded-2xl border border-border p-4 space-y-3">
      {note && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">{note}</p>}

      <div className="bg-white border border-border rounded-xl p-3 space-y-2">
        <p className="text-sm font-semibold text-foreground">Automated image & link review</p>
        <p className="text-xs text-muted-foreground">
          After you submit, the site automatically checks your image and destination link. If it looks OK, your creative is approved right away. Community flagging catches anything that slips through. If it’s declined, update the asset or request a manual review.
        </p>
        <ul className="space-y-1">
          {AD_IMAGE_REVIEW_GUIDELINES.map((item) => (
            <li key={item} className="text-xs text-muted-foreground flex gap-2">
              <span className="text-peach-400 font-bold shrink-0">✦</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground pt-1">
          Full policy: <a href="/supporters" target="_blank" rel="noreferrer" className="text-mint-500 underline">Supporter Rules</a>
        </p>
      </div>

      <div>
        <Label>Asset Name *</Label>
        <Input className="mt-1" placeholder="Summer Camp Banner" value={form.ad_name} onChange={(e) => setForm((f) => ({ ...f, ad_name: e.target.value }))} />
      </div>
      <div>
        <Label>Ad Image *</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-1">
          Recommended: 600 × 400 px (3:2 landscape), JPG or PNG, under 2 MB. Keep the main subject centered — images fill the ad frame and may crop edges if the ratio differs.
        </p>
        <div className="mt-2 space-y-2">
          {form.image_url ? (
            <div className="w-full max-w-sm aspect-[3/2] rounded-xl border border-border overflow-hidden">
              <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full max-w-sm aspect-[3/2] rounded-xl bg-muted flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border">
              No image
            </div>
          )}
          <label className="cursor-pointer inline-block">
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? "Uploading…" : form.image_url ? "Replace Image" : "Upload Image"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
        </div>
      </div>
      <div>
        <Label>Destination URL *</Label>
        <Input className="mt-1" placeholder="https://yourbusiness.com" value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
          disabled={!form.ad_name || !form.image_url || !form.link_url || moderating}
          onClick={onSubmit}
        >
          {moderating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Reviewing…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}
