import React, { useState } from "react";
import moment from "moment";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Loader2, ImagePlus, TrendingUp, BellOff, Trash2,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AdLibraryManager from "@/components/ads/AdLibraryManager";

const STATUS_CONFIG = {
  pending_payment: { label: "Pending Payment", color: "bg-yellow-100 text-yellow-700" },
  pending_review: { label: "Pending Review", color: "bg-yellow-100 text-yellow-700" },
  active: { label: "Active", color: "bg-mint-100 text-mint-600" },
  past_due: { label: "Payment Past Due", color: "bg-orange-100 text-orange-700" },
  rejected: { label: "Not Approved", color: "bg-red-100 text-red-600" },
  expired: { label: "Paused/Deactivated", color: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Paused/Deactivated", color: "bg-gray-100 text-gray-500" },
  flagged: { label: "Flagged", color: "bg-peach-100 text-peach-600" },
};

/**
 * My Active Ads card — Base44 layout parity.
 * Change Creative + admin delete work now. Plan switch / Stripe non-renew
 * return when billing launches; beta can still mark auto_renew locally.
 */
export default function ActiveAdCard({ ad, user, onRefresh }) {
  const { toast } = useToast();
  const [showChangeCreative, setShowChangeCreative] = useState(false);
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [showNonRenewConfirm, setShowNonRenewConfirm] = useState(false);
  const [nonRenewLoading, setNonRenewLoading] = useState(false);
  const [adminDeleting, setAdminDeleting] = useState(false);

  const cfg = STATUS_CONFIG[ad.status] || STATUS_CONFIG.pending_review;
  const isAdmin = user?.role === "admin" || user?.is_owner;
  const renewalDate = ad.next_renewal_date ? moment(ad.next_renewal_date) : null;
  const daysUntilRenewal = renewalDate ? renewalDate.diff(moment(), "days") : null;
  const withinCancellationWindow = daysUntilRenewal !== null && daysUntilRenewal < 14;
  const nextTermEnd = renewalDate
    ? moment(renewalDate).add(1, ad.plan_type === "annual" ? "year" : "month").format("MMM D, YYYY")
    : null;
  const impressions = Number(ad.impressions || 0);
  const clicks = Number(ad.clicks || 0);
  const ctr = impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "0.0%";
  const billingLive = !!ad.stripe_subscription_id;

  const handleChangeCreative = async (asset) => {
    setCreativeLoading(true);
    try {
      if (asset.moderation_status !== "approved") {
        throw new Error("Only approved assets can be used.");
      }
      const { error } = await supabase
        .from("banner_ads")
        .update({
          business_name: asset.ad_name,
          image_url: asset.image_url,
          link_url: asset.link_url,
          ad_library_id: asset.id,
          moderation_status: "approved",
          moderation_notes: null,
        })
        .eq("id", ad.id)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({ title: "Ad creative updated" });
      setShowChangeCreative(false);
      onRefresh?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCreativeLoading(false);
  };

  const handlePlanSwitchClick = () => {
    toast({
      title: "Coming after beta",
      description: "Plan switches at renewal will be available when Stripe billing launches.",
    });
  };

  const handleNonRenew = async () => {
    setNonRenewLoading(true);
    try {
      // Beta: flip auto_renew locally. With Stripe, this will also cancel the subscription renewal.
      const { error } = await supabase
        .from("banner_ads")
        .update({ auto_renew: false })
        .eq("id", ad.id)
        .eq("user_id", user.id);
      if (error) throw error;
      toast({
        title: "Non-renew set",
        description: billingLive
          ? "Your ad will run until the end of the current term and will not be charged again."
          : "Your ad is marked non-renewing. Billing automation returns after beta.",
      });
      setShowNonRenewConfirm(false);
      onRefresh?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setNonRenewLoading(false);
  };

  const handleAdminDelete = async () => {
    if (!window.confirm(
      `Delete this ad for zip ${ad.zip_code} and release the zip code slot? This permanently removes the ad and cannot be undone.`
    )) return;
    setAdminDeleting(true);
    try {
      const { error } = await supabase.from("banner_ads").delete().eq("id", ad.id);
      if (error) throw error;
      toast({ title: "Ad deleted", description: `Zip code ${ad.zip_code} has been released.` });
      onRefresh?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setAdminDeleting(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.business_name}
            className="w-full sm:w-32 h-20 object-cover rounded-xl border border-border shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-heading font-semibold">Zip {ad.zip_code}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            {ad.auto_renew === false && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                Non-renewing
              </span>
            )}
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
            {renewalDate && ad.auto_renew !== false && (
              <span>Renews {renewalDate.format("MMM D, YYYY")}</span>
            )}
            {renewalDate && ad.auto_renew === false && (
              <span className="text-amber-600 font-medium">
                Ends {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : renewalDate.format("MMM D, YYYY")} (no renewal)
              </span>
            )}
          </div>

          {ad.auto_renew !== false && withinCancellationWindow && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-3">
              <p className="font-semibold mb-0.5">
                ⚠️ Renewal in {daysUntilRenewal} day{daysUntilRenewal !== 1 ? "s" : ""} — cancellation window has passed
              </p>
              <p>
                Your next renewal charge is committed. If you set Non-renew now, your ad will continue through the upcoming paid term and expire at the end of it (<strong>{nextTermEnd}</strong>).
              </p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Impressions", value: impressions.toLocaleString() },
              { label: "Clicks", value: clicks.toLocaleString() },
              { label: "CTR", value: ctr },
              { label: "Flags", value: `${ad.flag_count || 0} of 3` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-2 text-center">
                <p className="font-heading font-bold text-sm">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Change Creative */}
          <div className="mb-3">
            {!showChangeCreative ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-7 text-xs mr-2"
                onClick={() => setShowChangeCreative(true)}
              >
                <ImagePlus className="w-3 h-3 mr-1" /> Change Creative
              </Button>
            ) : (
              <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold">Select an approved asset to use for this ad</p>
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
                  <AdLibraryManager user={user} onSelectAsset={handleChangeCreative} />
                )}
              </div>
            )}
          </div>

          {/* Plan switch — UI present; Stripe wiring after beta */}
          <div className="mb-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl h-7 text-xs"
              onClick={handlePlanSwitchClick}
            >
              <TrendingUp className="w-3 h-3 mr-1" />
              {ad.plan_type === "annual" ? "Switch to Monthly at Renewal" : "Switch to Annual at Renewal"}
            </Button>
          </div>

          {/* Non-renew */}
          {ad.auto_renew !== false && (
            <div className="mb-3">
              {!showNonRenewConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => setShowNonRenewConfirm(true)}
                >
                  <BellOff className="w-3 h-3 mr-1" /> Set Non-renew
                </Button>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
                  {withinCancellationWindow && billingLive ? (
                    <>
                      <p className="font-semibold text-amber-800">⚠️ Your next renewal charge cannot be avoided</p>
                      <p className="text-amber-700">
                        Because your renewal date (<strong>{renewalDate?.format("MMM D, YYYY")}</strong>) is within 14 days, the upcoming charge has already been committed.
                      </p>
                      <p className="text-amber-700">
                        Your ad will remain active through that paid term and will automatically expire on <strong>{nextTermEnd}</strong>.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-amber-800">Confirm Non-renew</p>
                      <p className="text-amber-700">
                        Your ad will continue running until{" "}
                        <strong>
                          {ad.plan_end_date
                            ? moment(ad.plan_end_date).format("MMM D, YYYY")
                            : renewalDate?.format("MMM D, YYYY") || "the end of the current term"}
                        </strong>{" "}
                        and will not renew.
                        {!billingLive && " (Beta: marks this placement non-renewing; Stripe cancel returns after billing launches.)"}
                      </p>
                    </>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="rounded-xl h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                      disabled={nonRenewLoading}
                      onClick={handleNonRenew}
                    >
                      {nonRenewLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      {withinCancellationWindow && billingLive ? "Understood — Set Non-renew" : "Confirm Non-renew"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl h-7 text-xs"
                      onClick={() => setShowNonRenewConfirm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="mb-1">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
                disabled={adminDeleting}
                onClick={handleAdminDelete}
              >
                {adminDeleting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Trash2 className="w-3 h-3 mr-1" />}
                Delete Ad & Release Zip Code (Admin)
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
