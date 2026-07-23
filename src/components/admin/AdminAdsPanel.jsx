import React, { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Clock, ExternalLink, Trash2, Image, HelpCircle, Flag, RotateCcw } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import moment from "moment";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";

const STATUS_CONFIG = {
  active:          { label: "Active",          color: "bg-mint-50 text-mint-500" },
  pending_review:  { label: "Pending Review",  color: "bg-blue-50 text-blue-600" },
  pending_payment: { label: "Pending Payment", color: "bg-yellow-50 text-yellow-600" },
  rejected:        { label: "Rejected",        color: "bg-red-50 text-red-500" },
  expired:         { label: "Expired",         color: "bg-gray-100 text-gray-500" },
  cancelled:       { label: "Paused/Deactivated", color: "bg-gray-100 text-gray-500" },
  flagged:         { label: "Flagged",         color: "bg-peach-50 text-peach-500" },
};

export default function AdminAdsPanel({ ads, onRefresh, toast }) {
  const [rejectionNotes, setRejectionNotes] = useState({});

  const [adsPage, setAdsPage] = useState(1);
  const [adsSortBy, setAdsSortBy] = useState("created_at");
  const [adsSortOrder, setAdsSortOrder] = useState("desc");
  const [adsSearch, setAdsSearch] = useState("");

  const handleApprove = async (ad) => {
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
    toast?.({ title: `"${ad.business_name}" rejected.` });
    onRefresh?.();
  };

  const handlePause = async (ad) => {
    const notes = window.prompt("Provide an explanation for deactivating this ad. This will be shown to the Supporter and emailed to them:");
    if (notes === null) return;
    if (!notes.trim()) {
      toast?.({ title: "An explanation is required to deactivate this ad.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("banner_ads").update({
      status: "cancelled",
      replacement_required: true,
      moderation_notes: notes.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", ad.id);
    if (error) {
      toast?.({ title: "Failed to deactivate ad", variant: "destructive" });
      return;
    }
    // Email notification to advertiser returns when the email engine is migrated off Base44.
    toast?.({ title: "Ad paused and removed from feed" });
    onRefresh?.();
  };

  const handleFlag = async (ad) => {
    const notes = window.prompt("Provide an explanation for flagging this ad. This will be shown to the Supporter and emailed to them:");
    if (notes === null) return;
    if (!notes.trim()) {
      toast?.({ title: "An explanation is required to flag this ad.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("banner_ads").update({
      status: "flagged",
      moderation_notes: notes.trim(),
      updated_at: new Date().toISOString(),
    }).eq("id", ad.id);
    if (error) {
      toast?.({ title: "Failed to flag ad", variant: "destructive" });
      return;
    }
    // Email notification to advertiser returns when the email engine is migrated off Base44.
    toast?.({ title: "Ad flagged for review" });
    onRefresh?.();
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
      list = list.filter((a) =>
        (a.business_name || "").toLowerCase().includes(s) ||
        (a.zip_code || "").includes(s) ||
        (a.plan_type || "").toLowerCase().includes(s) ||
        (a.status || "").toLowerCase().includes(s)
      );
    }
    list.sort((a, b) => {
      let aVal;
      let bVal;
      if (adsSortBy === "business_name") {
        aVal = (a.business_name || "").toLowerCase();
        bVal = (b.business_name || "").toLowerCase();
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
            {pendingAds.map((ad) => (
              <div key={ad.id} className="bg-white rounded-2xl border border-blue-100 p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {ad.image_url && (
                    <img src={ad.image_url} alt={ad.business_name} className="w-full sm:w-40 h-24 object-cover rounded-xl border border-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h4 className="font-heading font-semibold">{ad.business_name}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">Pending Review</span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5 mb-3">
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
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden">
        <div className="pb-4 border-b border-border">
          <Input
            placeholder="Search by business, zip, plan, or status…"
            value={adsSearch}
            onChange={(e) => { setAdsSearch(e.target.value); setAdsPage(1); }}
            className="rounded-lg h-8 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground cursor-pointer hover:bg-muted/70 select-none" onClick={() => toggleAdsSort("business_name")}>
                  Business{sortArrow("business_name")}
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
                return (
                  <tr key={a.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium max-w-[160px] truncate">{a.business_name}</td>
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
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleFlag(a)} title="Flag">
                              <Flag className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handlePause(a)} title="Removes ad from public feed. Advertiser's subscription stays active; they can submit a replacement.">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
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
    </div>
  );
}
