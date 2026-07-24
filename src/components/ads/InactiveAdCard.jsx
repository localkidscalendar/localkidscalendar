import React, { useState } from "react";
import moment from "moment";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Loader2, ImagePlus, CreditCard } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AdLibraryManager from "@/components/ads/AdLibraryManager";
import { openBillingPortal } from "@/lib/adBilling";

// Statuses where the Supporter can swap creative and go live again immediately.
const RECOVERABLE_STATUSES = ["flagged", "rejected"];

const STATUS_LABELS = {
  pending_payment: "Pending Payment",
  pending_review: "Pending Review",
  past_due: "Payment Past Due",
  rejected: "Not Approved",
  expired: "Expired",
  cancelled: "Paused/Cancelled",
  flagged: "Flagged",
};

function getReasonText(ad) {
  switch (ad.status) {
    case "flagged":
      return (ad.flag_count || 0) >= 3
        ? `This ad was flagged by ${ad.flag_count} users and automatically paused for review.`
        : "This ad was flagged by our Admin team for review.";
    case "cancelled":
      return ad.cancelled_at
        ? "This ad's subscription has ended and is no longer billing."
        : "This ad was deactivated by our Admin team.";
    case "rejected":
      return "This ad was not approved by our Admin team.";
    case "past_due":
      return "This ad requires payment to reactivate.";
    case "expired":
      return "This ad's subscription expired after a failed payment grace period.";
    case "pending_payment":
      return "Waiting for payment to be completed.";
    case "pending_review":
      return "Awaiting review by our Admin team.";
    default:
      return null;
  }
}

export default function InactiveAdCard({ ad, user, onRefresh }) {
  const { toast } = useToast();
  const [showChangeCreative, setShowChangeCreative] = useState(false);
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleOpenBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const url = await openBillingPortal({ ad_id: ad.id });
      window.location.href = url;
    } catch (err) {
      toast({ title: "Could not open billing portal", description: err.message, variant: "destructive" });
      setPortalLoading(false);
    }
  };

  const isRecoverable =
    RECOVERABLE_STATUSES.includes(ad.status) || (ad.status === "cancelled" && !ad.cancelled_at);
  const statusLabel = STATUS_LABELS[ad.status] || "Inactive";
  const impressions = Number(ad.impressions || 0);
  const clicks = Number(ad.clicks || 0);

  const handleChangeCreative = async (asset) => {
    setCreativeLoading(true);
    try {
      if (asset.moderation_status !== "approved") {
        throw new Error("Only approved assets can be used.");
      }
      const update = {
        business_name: asset.ad_name,
        image_url: asset.image_url,
        link_url: asset.link_url,
        ad_library_id: asset.id,
        moderation_status: "approved",
        moderation_notes: null,
      };
      if (isRecoverable) {
        update.status = "active";
      }
      const { error } = await supabase
        .from("banner_ads")
        .update(update)
        .eq("id", ad.id)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({
        title: isRecoverable ? "Ad reactivated!" : "Creative updated",
        description: isRecoverable ? "Your new creative is now live." : undefined,
      });
      setShowChangeCreative(false);
      onRefresh?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCreativeLoading(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.business_name}
            className="w-full sm:w-40 aspect-[2/1] object-contain rounded-xl border border-border shrink-0 opacity-70 bg-muted/30"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-heading font-semibold">Zip {ad.zip_code}</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
              {statusLabel}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-1">
            <span>{ad.business_name}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            <span className="capitalize">{ad.plan_type} plan</span>
            {ad.plan_start_date && (
              <span>
                {moment(ad.plan_start_date).format("MMM D, YYYY")} →{" "}
                {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : "—"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Impressions", value: impressions.toLocaleString() },
              { label: "Clicks", value: clicks.toLocaleString() },
              {
                label: "CTR",
                value: impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "—",
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-2 text-center">
                <p className="font-heading font-bold text-sm">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {ad.moderation_notes && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700 mb-3">
              <p className="font-semibold mb-1">Note:</p>
              <p>{ad.moderation_notes}</p>
            </div>
          )}

          {ad.status === "past_due" && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">
              <p className="mb-2">
                {getReasonText(ad)} Your renewal payment failed — update your payment method to restore this ad.
              </p>
              {ad.stripe_customer_id ? (
                <Button
                  size="sm"
                  className="rounded-xl h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
                  disabled={portalLoading}
                  onClick={handleOpenBillingPortal}
                >
                  {portalLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
                  Update Payment Method
                </Button>
              ) : (
                <p className="text-orange-600/80 italic">No billing account found for this ad — contact support.</p>
              )}
            </div>
          )}

          {isRecoverable && (
            <div>
              {!showChangeCreative ? (
                <div className="bg-mint-50 border border-mint-200 rounded-xl p-3 text-xs text-mint-700">
                  <p className="mb-2">
                    {getReasonText(ad)} Select a pre-approved creative to fix this and go live again.
                  </p>
                  <Button
                    size="sm"
                    className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white"
                    onClick={() => setShowChangeCreative(true)}
                  >
                    <ImagePlus className="w-3 h-3 mr-1" /> Change Creative & Reactivate
                  </Button>
                </div>
              ) : (
                <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Select an approved asset to reactivate this ad</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl h-7 text-xs"
                      onClick={() => setShowChangeCreative(false)}
                      disabled={creativeLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                  {creativeLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-mint-500" />
                    </div>
                  ) : (
                    <AdLibraryManager user={user} onSelectAsset={handleChangeCreative} allowAddNew />
                  )}
                </div>
              )}
            </div>
          )}

          {!isRecoverable && ad.status !== "past_due" && getReasonText(ad) && (
            <p className="text-xs text-muted-foreground">{getReasonText(ad)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
