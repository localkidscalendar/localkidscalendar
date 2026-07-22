import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, CheckCircle, XCircle, Clock, AlertCircle, Trash2, ExternalLink, Plus, ImageIcon, Pencil, HelpCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import ImagePreviewModal from "@/components/ads/ImagePreviewModal";

const MOD_CONFIG = {
  pending:                { label: "Pending Review",         color: "bg-yellow-100 text-yellow-700", icon: Clock },
  approved:               { label: "Approved",               color: "bg-mint-100 text-mint-600",     icon: CheckCircle },
  declined:               { label: "Declined",               color: "bg-red-100 text-red-600",       icon: XCircle },
  manual_review:          { label: "Manual Review Requested", color: "bg-blue-100 text-blue-700",   icon: AlertCircle },
  manual_review_declined: { label: "Manual Review Decline",  color: "bg-red-100 text-red-700",       icon: XCircle },
};

const EMPTY_FORM = { ad_name: "", image_url: "", link_url: "" };
const LIVE_AD_STATUSES = ["active", "pending_payment", "pending_review", "flagged", "past_due"];

const assetKey = (a) => `${a.image_url}|${a.link_url}`;

export default function AdLibraryManager({ user, onSelectAsset, allowAddNew = false }) {
  const [assets, setAssets] = useState([]);
  const [flaggedKeys, setFlaggedKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [moderating, setModerating] = useState(null); // asset id or "new"
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // id of declined asset being re-edited
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => { loadAssets(); }, [user]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const [items, flaggedAds] = await Promise.all([
        base44.entities.AdLibrary.filter({ user_id: user.id }, "-created_date", 50),
        base44.entities.BannerAd.filter({ user_id: user.id, status: "flagged" }),
      ]);
      setAssets(items);
      setFlaggedKeys(new Set(flaggedAds.map(assetKey)));
    } catch { setAssets([]); }
    setLoading(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, image_url: file_url }));
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.ad_name || !form.image_url || !form.link_url) return;
    setModerating("new");
    try {
      const asset = await base44.entities.AdLibrary.create({
        user_id: user.id,
        ad_name: form.ad_name,
        image_url: form.image_url,
        link_url: form.link_url,
        moderation_status: "pending",
      });
      await runModeration(asset.id);
      setForm(EMPTY_FORM);
      setShowForm(false);
      loadAssets();
    } catch {
      toast({ title: "Failed to save asset", variant: "destructive" });
    }
    setModerating(null);
  };

  const handleResubmit = async (assetId) => {
    if (!form.ad_name || !form.image_url || !form.link_url) return;
    setModerating(assetId);
    try {
      await base44.entities.AdLibrary.update(assetId, {
        ad_name: form.ad_name,
        image_url: form.image_url,
        link_url: form.link_url,
        moderation_status: "pending",
        moderation_notes: "",
      });
      await runModeration(assetId);
      setEditingId(null);
      setForm(EMPTY_FORM);
      loadAssets();
    } catch {
      toast({ title: "Failed to resubmit asset", variant: "destructive" });
    }
    setModerating(null);
  };

  const handleRequestManual = async (asset) => {
    setModerating(asset.id);
    try {
      await base44.entities.AdLibrary.update(asset.id, {
        moderation_status: "manual_review",
      });
      toast({ title: "Manual review requested", description: "Our team will review your ad shortly." });
      loadAssets();
    } catch {
      toast({ title: "Failed to request manual review", variant: "destructive" });
    }
    setModerating(null);
  };

  const runModeration = async (assetId) => {
    try {
      const res = await base44.functions.invoke("moderateAdContent", { ad_library_id: assetId });
      const status = res.data?.status || "pending";
      if (status === "approved") {
        toast({ title: "Asset approved!", description: "Your ad creative is ready to use." });
      } else if (status === "declined") {
        toast({ title: "Asset not approved", description: res.data?.reason || "Please review the guidelines and try again.", variant: "destructive" });
      } else {
        toast({ title: "Asset submitted for manual review." });
      }
    } catch {
      toast({ title: "Asset submitted", description: "It will be reviewed shortly." });
    }
  };

  const handleDelete = async (asset) => {
    const liveAds = await base44.entities.BannerAd.filter({ user_id: user.id, image_url: asset.image_url, link_url: asset.link_url });
    const inUse = liveAds.some(ad => LIVE_AD_STATUSES.includes(ad.status));
    if (inUse) {
      toast({ title: "Can't delete this asset", description: "It's currently being used in a live ad campaign. Remove or replace that campaign's creative first.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Remove this asset from your library?")) return;
    await base44.entities.AdLibrary.delete(asset.id);
    setAssets(a => a.filter(x => x.id !== asset.id));
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

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-mint-500" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold">Ad Library</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {onSelectAsset
              ? "Select an approved asset below. To add or manage assets, use the Ad Library tab."
              : "Upload ad images and links for pre-approval so checkout goes live instantly."}
          </p>
        </div>
        {(!onSelectAsset || allowAddNew) && !showForm && !editingId && (
          <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => setShowForm(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Asset
          </Button>
        )}
      </div>

      {/* New asset form */}
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
          {assets.map(asset => {
            const cfg = MOD_CONFIG[asset.moderation_status] || MOD_CONFIG.pending;
            const Icon = cfg.icon;
            const isApproved = asset.moderation_status === "approved";
            const isDeclined = asset.moderation_status === "declined";
            const isManualDeclined = asset.moderation_status === "manual_review_declined";
            const isAnyDeclined = isDeclined || isManualDeclined;
            const isEditing = editingId === asset.id;
            const isFlaggedInUse = flaggedKeys.has(assetKey(asset));
            const isSelectable = isApproved && !isFlaggedInUse;

            return (
              <div key={asset.id} className="rounded-2xl border bg-white overflow-hidden">
                {/* Main row */}
                <div
                  className={`flex items-center gap-3 p-3 ${onSelectAsset && isSelectable ? "cursor-pointer hover:border-mint-300" : ""}`}
                  onClick={() => onSelectAsset && isSelectable && onSelectAsset(asset)}
                >
                  {asset.image_url && (
                    <img src={asset.image_url} alt={asset.ad_name} className="w-16 h-10 object-cover rounded-lg border border-border shrink-0" />
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
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {onSelectAsset && isSelectable && (
                      <Button size="sm" className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white" onClick={() => onSelectAsset(asset)}>
                        Use
                      </Button>
                    )}
                    {/* Open image */}
                    {asset.image_url && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="View image" onClick={() => setPreviewImage(asset.image_url)}>
                        <ImageIcon className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {/* Open URL */}
                    <a href={asset.link_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Open destination URL">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                    {/* Edit (declined assets) — only in library mode */}
                    {!onSelectAsset && isAnyDeclined && !isEditing && (
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

                {/* Flagged notice — shown in both modes */}
                {isFlaggedInUse && (
                  <div className="px-3 pb-3">
                    <div className="bg-peach-50 border border-peach-100 rounded-xl p-3 text-xs text-peach-700">
                      This creative is currently in use by a flagged ad and can't be reused until that ad is resolved.
                    </div>
                  </div>
                )}

                {/* Decline reason — full text, only in library mode */}
                {!onSelectAsset && asset.moderation_notes && isAnyDeclined && !isEditing && (
                  <div className="px-3 pb-3">
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 leading-relaxed">
                      <p className="font-semibold mb-1">Decline reason:</p>
                      <p>{asset.moderation_notes}</p>
                      {isDeclined && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs border-red-200 hover:bg-red-100" onClick={() => startEdit(asset)}>
                            <Pencil className="w-3 h-3 mr-1" /> Edit & Resubmit
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-xl h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                            disabled={moderating === asset.id}
                            onClick={() => handleRequestManual(asset)}>
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

                {/* Inline edit form for declined asset */}
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
                      note="Update the fields that caused the decline, then resubmit."
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
      <div>
        <Label>Asset Name *</Label>
        <Input className="mt-1" placeholder="Summer Camp Banner" value={form.ad_name} onChange={e => setForm(f => ({ ...f, ad_name: e.target.value }))} />
      </div>
      <div>
        <Label>Ad Image *</Label>
        <div className="mt-1 flex items-center gap-3">
          {form.image_url
            ? <img src={form.image_url} alt="Preview" className="h-16 rounded-lg object-cover border border-border" />
            : <div className="h-16 w-32 rounded-lg bg-muted flex items-center justify-center text-xs text-muted-foreground border border-dashed border-border">No image</div>
          }
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors">
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              {uploading ? "Uploading…" : "Upload Image"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          </label>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Recommended: 600×300px. PNG or JPG.</p>
      </div>
      <div>
        <Label>Destination URL *</Label>
        <Input className="mt-1" placeholder="https://yourbusiness.com" value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} />

      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-xl" onClick={onCancel}>Cancel</Button>
        <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
          disabled={!form.ad_name || !form.image_url || !form.link_url || moderating}
          onClick={onSubmit}>
          {moderating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Reviewing…</> : submitLabel}
        </Button>
      </div>
    </div>
  );
}