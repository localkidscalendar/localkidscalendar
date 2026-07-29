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
        ? `This ad creative was flagged by the community and disabled across all zip placements using it.`
        : "This ad creative was disabled by our Admin team. Assign a different approved creative to restore this zip.";
    case "cancelled":
      return ad.cancelled_at
        ? "This ad's subscription has ended and is no longer billing."
        : "This ad was deactivated by our Admin team.";
    case "rejected":
      return "This ad was not approved by our Admin team.";
    case "past_due": {
      const deadline = ad.grace_period_start
        ? moment(ad.grace_period_start).add(7, "days").format("MMM D, YYYY")
        : null;
      return deadline
        ? `Payment failed. Your spot is reserved until ${deadline}. If payment isn’t updated by then, this spot will be released and may be offered to the waitlist.`
        : "Payment failed. Update your payment method within 7 days or this spot may be released to the waitlist.";
    }
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
  const ctr = impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "—";

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
        description: isRecoverable ? "Your new creative is now live for this zip." : undefined,
      });
      setShowChangeCreative(false);
      onRefresh?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCreativeLoading(false);
  };

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex gap-3">
        {ad.image_url ? (
          <img
            src={ad.image_url}
            alt={ad.business_name}
            className="w-24 sm:w-28 aspect-[2/1] object-contain rounded-lg border border-border shrink-0 opacity-70 bg-muted/30"
          />
        ) : null}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-heading font-semibold text-sm">Zip {ad.zip_code}</h3>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">
              {statusLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">{ad.business_name}</p>
          <p className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
            <span className="capitalize">{ad.plan_type} plan</span>
            {ad.plan_start_date ? (
              <span>
                {moment(ad.plan_start_date).format("MMM D, YYYY")}
                {" → "}
                {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : "—"}
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {[
          { label: "Impressions", value: impressions.toLocaleString() },
          { label: "Clicks", value: clicks.toLocaleString() },
          { label: "CTR", value: ctr },
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/40 rounded-lg px-1.5 py-1.5 text-center">
            <p className="font-heading font-bold text-xs sm:text-sm leading-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {ad.moderation_notes ? (
        <div className="mt-2 bg-red-50 border border-red-100 rounded-lg px-2.5 py-2 text-[11px] text-red-700">
          <span className="font-semibold">Note: </span>
          {ad.moderation_notes}
        </div>
      ) : null}

      <div className="mt-2 pt-2 border-t border-border space-y-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          Updates
        </p>

        {ad.status === "past_due" ? (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-2 text-[11px] text-orange-700">
            <p className="mb-2">
              {getReasonText(ad)} Update your payment method in Ad Manager to restore this ad.
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
        ) : null}

        {isRecoverable ? (
          !showChangeCreative ? (
            <div className="bg-mint-50 border border-mint-200 rounded-lg px-2.5 py-2 text-[11px] text-mint-700">
              <p className="mb-2">
                {getReasonText(ad)} Select a different approved creative to fix this zip and go live again.
              </p>
              <Button
                size="sm"
                className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white"
                onClick={() => setShowChangeCreative(true)}
              >
                <ImagePlus className="w-3 h-3 mr-1" /> Change Creative &amp; Reactivate
              </Button>
            </div>
          ) : (
            <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold">Select an approved asset to reactivate</p>
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
          )
        ) : null}

        {!isRecoverable && ad.status !== "past_due" && getReasonText(ad) ? (
          <p className="text-[11px] text-muted-foreground">{getReasonText(ad)}</p>
        ) : null}
      </div>
    </div>
  );
}
