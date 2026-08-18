import React, { useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Clock, ExternalLink, Image, HelpCircle, Ban, RotateCcw } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import SearchClearField from "@/components/shared/SearchClearField";
import AdminNoteConfirmDialog from "@/components/admin/AdminNoteConfirmDialog";
import moment from "moment";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";
import {
  disableAdAssetFromBanner,
  reactivateAdAssetFromBanner,
  sendAdAssetDisabledEmail,
  markAdAssetDisableNotified,
} from "@/lib/quarantineAdLibrary";
import { notifyAdCreativeDisabledAdmin } from "@/lib/userMessages";

const STATUS_CONFIG = {
  active:          { label: "Active",          color: "bg-mint-50 text-mint-500" },
  pending_review:  { label: "Pending Review",  color: "bg-blue-50 text-blue-600" },
  pending_payment: { label: "Pending Payment", color: "bg-yellow-50 text-yellow-600" },
  rejected:        { label: "Rejected",        color: "bg-red-50 text-red-500" },
  expired:         { label: "Expired",         color: "bg-gray-100 text-gray-500" },
  cancelled:       { label: "Paused/Deactivated", color: "bg-gray-100 text-gray-500" },
  flagged:         { label: "Flagged",         color: "bg-peach-50 text-peach-500" },
};

function profileName(user) {
  if (!user) return "";
  return (
    user.full_name
    || [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
    || ""
  );
}

export default function AdminAdsPanel({ ads, users = [], onRefresh, toast }) {
  const [rejectionNotes, setRejectionNotes] = useState({});
  const [disableDialogAd, setDisableDialogAd] = useState(null);
  const [disableBusy, setDisableBusy] = useState(false);

  const [adsPage, setAdsPage] = useState(1);
  const [adsSortBy, setAdsSortBy] = useState("created_at");
  const [adsSortOrder, setAdsSortOrder] = useState("desc");
  const [adsSearch, setAdsSearch] = useState("");

  const usersById = useMemo(() => {
    const map = {};
    (users || []).forEach((u) => {
      if (u?.id) map[u.id] = u;
    });
    return map;
  }, [users]);

  const supporterInfo = (ad) => {
    const user = usersById[ad.user_id];
    const name = profileName(user) || user?.email || "Unknown user";
    const email = user?.email || "";
    const adName = ad.business_name || "";
    return { name, email, adName };
  };

  const handleApprove = async (ad) => {
    // Flagged ads: Admin restore re-approves the Ad Asset and all related zip placements.
    if (ad.status === "flagged") {
      const { data, error } = await reactivateAdAssetFromBanner(ad.id);
      if (error) {
        toast?.({ title: "Failed to restore ad creative", description: error.message, variant: "destructive" });
        return;
      }
      const zips = data?.zip_codes || [];
      toast?.({
        title: `"${ad.business_name}" restored`,
        description: zips.length > 1 ? `Reactivated ${zips.length} zip placements.` : undefined,
      });
      onRefresh?.();
      return;
    }

    const { error } = await supabase.from("banner_ads").update({
      status: "active",
      moderation_status: "approved",
      moderation_notes: "",
      updated_at: new Date().toISOString(),
    }).eq("id", ad.id);
    if (error) {
      toast?.({ title: "Failed to approve ad", variant: "destructive" });
      return;
    }
    toast?.({ title: `"${ad.business_name}" approved and now live!` });
    onRefresh?.();
  };

  const handleReject = async (ad) => {
    const notes = rejectionNotes[ad.id] || "";
    const { error } = await supabase.from("banner_ads").update({
      status: "rejected",
      moderation_status: "rejected",
      moderation_notes: notes,
      updated_at: new Date().toISOString(),
    }).eq("id", ad.id);
    if (error) {
      toast?.({ title: "Failed to reject ad", variant: "destructive" });
      return;
    }
    // Reject is zip-placement only — does not disable the Ad Asset.
    toast?.({ title: `"${ad.business_name}" rejected.` });
    onRefresh?.();
  };

  /** Disable the Ad Asset across every zip placement using it. */
  const handleDisableCreative = (ad) => {
    setDisableDialogAd(ad);
  };

  const confirmDisableCreative = async (notes) => {
    const ad = disableDialogAd;
    if (!ad) return;
    setDisableBusy(true);
    const reason = notes.trim();
    try {
      const { data, error } = await disableAdAssetFromBanner(ad.id, reason);
      if (error) {
        toast?.({ title: "Failed to disable ad creative", description: error.message, variant: "destructive" });
        return;
      }
      const zipCodes = data?.zip_codes || [ad.zip_code].filter(Boolean);
      const already = data?.already_disabled;
      if (!already) {
        await sendAdAssetDisabledEmail({
          userId: data?.user_id || ad.user_id,
          businessName: data?.business_name || ad.business_name,
          zipCodes,
          reason,
          templateKey: "ad_flagged_admin",
        });
        await notifyAdCreativeDisabledAdmin({
          userId: data?.user_id || ad.user_id,
          businessName: data?.business_name || ad.business_name,
          zipCodes,
          reason,
        });
        await markAdAssetDisableNotified(data?.asset_ids || []);
      }
      toast?.({
        title: "Ad creative disabled",
        description: zipCodes.length > 1
          ? `Disabled across ${zipCodes.length} zip placements. Supporter was notified.`
          : "Supporter was notified (email + My Messages).",
      });
      setDisableDialogAd(null);
      onRefresh?.();
    } finally {
      setDisableBusy(false);
    }
  };

  const pendingAds = ads.filter((a) => a.status === "pending_review");

  const toggleAdsSort = (col) => {
    if (adsSortBy === col) {
      setAdsSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setAdsSortBy(col);
      setAdsSortOrder("asc");
    }
    setAdsPage(1);
  };

  const sortArrow = (col) => (adsSortBy === col ? (adsSortOrder === "asc" ? " ↑" : " ↓") : "");

  const filteredAds = (() => {
    let list = [...ads];
    if (adsSearch.trim()) {
      const s = adsSearch.toLowerCase();
      list = list.filter((a) => {
        const { name, email, adName } = supporterInfo(a);
        return (
          name.toLowerCase().includes(s) ||
          email.toLowerCase().includes(s) ||
          adName.toLowerCase().includes(s) ||
          (a.zip_code || "").includes(s) ||
          (a.plan_type || "").toLowerCase().includes(s) ||
          (a.status || "").toLowerCase().includes(s)
        );
      });
    }
    list.sort((a, b) => {
      let aVal;
      let bVal;
      if (adsSortBy === "supporter") {
        aVal = supporterInfo(a).name.toLowerCase();
        bVal = supporterInfo(b).name.toLowerCase();
      } else if (adsSortBy === "zip_code") {
        aVal = a.zip_code || "";
        bVal = b.zip_code || "";
      } else if (adsSortBy === "plan_type") {
        aVal = a.plan_type || "";
        bVal = b.plan_type || "";
      } else if (adsSortBy === "status") {
        aVal = a.status || "";
        bVal = b.status || "";
      } else if (adsSortBy === "next_renewal_date") {
        aVal = a.next_renewal_date || "";
        bVal = b.next_renewal_date || "";
      } else {
        aVal = a.created_at || "";
        bVal = b.created_at || "";
      }
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return adsSortOrder === "asc" ? cmp : -cmp;
    });
    return list;
  })();

  const adsPageData = filteredAds.slice((adsPage - 1) * PAGE_SIZE, adsPage * PAGE_SIZE);

  return (
    <div className="space-y-6">

      {pendingAds.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <h3 className="font-heading font-semibold text-sm text-blue-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> {pendingAds.length} Ad{pendingAds.length !== 1 ? "s" : ""} Pending Review
          </h3>
          <div className="space-y-4">
            {pendingAds.map((ad) => {
              const { name, email, adName } = supporterInfo(ad);
              return (
              <div key={ad.id} className="bg-white rounded-2xl border border-blue-100 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {ad.image_url && (
                    <div className="w-full sm:w-44 aspect-[2/1] rounded-xl border border-border bg-muted/30 shrink-0 overflow-hidden flex items-center justify-center">
                      <img src={ad.image_url} alt={adName || name} className="max-w-full max-h-full object-contain" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h4 className="font-heading font-semibold">{name}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">Pending Review</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
                      {email ? <p>{email}</p> : null}
                      {adName ? <p>Ad: <strong className="text-foreground">{adName}</strong></p> : null}
                      <p>Zip: <strong>{ad.zip_code}</strong> · Plan: <strong className="capitalize">{ad.plan_type}</strong> · Rate: <strong>${ad.rate_at_purchase || (ad.plan_type === "annual" ? 1260 : 150)}</strong></p>
                      <p>Submitted: {moment(ad.created_at).format("MMM D, YYYY")}</p>
                      {ad.link_url && (
                        <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-mint-500 hover:underline">
                          <ExternalLink className="w-3 h-3" />{ad.link_url}
                        </a>
                      )}
                      {ad.discount_code_used && <p>Discount code: <strong>{ad.discount_code_used}</strong> ({ad.discount_amount}% off)</p>}
                    </div>
                    <div className="space-y-2">
                      <Input
                        placeholder="Rejection reason (required if rejecting)…"
                        value={rejectionNotes[ad.id] || ""}
                        onChange={(e) => setRejectionNotes((prev) => ({ ...prev, [ad.id]: e.target.value }))}
                        className="rounded-xl text-sm"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white flex-1" onClick={() => handleApprove(ad)}>
                          <Check className="w-3.5 h-3.5 mr-1" /> Approve & Activate
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-xl text-destructive border-destructive/20 flex-1" onClick={() => handleReject(ad)} disabled={!rejectionNotes[ad.id]?.trim()}>
                          <X className="w-3.5 h-3.5 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        <div className="pb-4 border-b border-border">
          <SearchClearField
            placeholder="Search by user, email, ad name, zip, plan, or status…"
            value={adsSearch}
            onValueChange={(v) => { setAdsSearch(v); setAdsPage(1); }}
            wrapperClassName="flex items-center gap-2 w-full"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none" onClick={() => toggleAdsSort("supporter")}>
                  Supporter{sortArrow("supporter")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none" onClick={() => toggleAdsSort("zip_code")}>
                  Zip{sortArrow("zip_code")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none" onClick={() => toggleAdsSort("plan_type")}>
                  Plan{sortArrow("plan_type")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none" onClick={() => toggleAdsSort("status")}>
                  Status{sortArrow("status")}
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stats</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none" onClick={() => toggleAdsSort("next_renewal_date")}>
                  Renewal{sortArrow("next_renewal_date")}
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adsPageData.map((a) => {
                const cfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending_review;
                const { name, email, adName } = supporterInfo(a);
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="font-medium truncate">{name}</p>
                      {email ? <p className="text-xs text-muted-foreground truncate">{email}</p> : null}
                      {adName ? <p className="text-xs text-muted-foreground truncate">Ad: {adName}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.zip_code}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{a.plan_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{a.impressions || 0} views · {a.clicks || 0} clicks</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.next_renewal_date ? moment(a.next_renewal_date).format("MMM D, YYYY") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {a.image_url && (
                          <a href={a.image_url} target="_blank" rel="noopener noreferrer" title="View ad image">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                              <Image className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                        )}
                        {a.link_url && (
                          <a href={a.link_url} target="_blank" rel="noopener noreferrer" title="Visit ad URL">
                            <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="w-3.5 h-3.5" /></Button>
                          </a>
                        )}
                        {a.status === "pending_review" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-mint-500" onClick={() => handleApprove(a)} title="Approve">
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleReject(a)} title="Reject">
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        {a.status === "active" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDisableCreative(a)}
                            title="Disable this ad creative across every zip placement using it. Billing stays active."
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {a.status === "rejected" && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-mint-500" onClick={() => handleApprove(a)}>Re-approve</Button>
                        )}
                        {(a.status === "expired" || a.status === "cancelled" || a.status === "flagged") && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleApprove(a)} title="Restore this ad to active — use if it was paused/flagged by mistake.">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {adsPageData.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-2">
                    <EmptyState
                      icon={HelpCircle}
                      title="No Ads Found"
                      description={adsSearch ? "No ads match your search criteria." : "No supporter ads have been created yet."}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Paginator total={filteredAds.length} page={adsPage} onPage={setAdsPage} />
      </div>

      <AdminNoteConfirmDialog
        open={Boolean(disableDialogAd)}
        onOpenChange={(open) => {
          if (!open) setDisableDialogAd(null);
        }}
        title="Disable Ad Creative"
        description={`Disable "${disableDialogAd?.business_name || "this creative"}" across all zip placements using it? Billing stays active; the Supporter must assign a different approved creative.`}
        noteLabel="Note to Supporter"
        notePlaceholder="Explain why this ad creative is being disabled…"
        noteRequired
        emailMode="always"
        confirmLabel="Disable Creative"
        loading={disableBusy}
        onConfirm={confirmDisableCreative}
      />
    </div>
  );
}
