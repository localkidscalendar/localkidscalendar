import React, { useEffect, useState } from "react";
import moment from "moment";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Loader2, ImagePlus, TrendingUp, BellOff, CreditCard, RefreshCw,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AdLibraryManager from "@/components/ads/AdLibraryManager";
import {
  cancelAdRenewal,
  formatAdPlanRate,
  formatMaskedCard,
  formatPlanTypeLabel,
  getAdPaymentMethod,
  openBillingPortalInNewTab,
  requestAdPlanChange,
  resumeAdRenewal,
} from "@/lib/adBilling";
import {
  RENEWAL_CANCELLATION_WINDOW_DAYS,
  canResumeAutoRenew,
  renewalDeadline,
  daysUntilDate,
} from "../../../shared/adRenewalPolicy.js";
import { RENEWAL_RATE_LOCK_DAYS } from "../../../shared/adBillingPolicy.js";

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
 * Compact placement card for live/active ads.
 */
export default function ActiveAdCard({ ad, user, onRefresh }) {
  const { toast } = useToast();
  const [showChangeCreative, setShowChangeCreative] = useState(false);
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [showNonRenewConfirm, setShowNonRenewConfirm] = useState(false);
  const [nonRenewLoading, setNonRenewLoading] = useState(false);
  const [showResumeRenewConfirm, setShowResumeRenewConfirm] = useState(false);
  const [resumeRenewLoading, setResumeRenewLoading] = useState(false);
  const [planSwitchLoading, setPlanSwitchLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardLabel, setCardLabel] = useState(null);

  const cfg = STATUS_CONFIG[ad.status] || STATUS_CONFIG.pending_review;
  const renewalDate = ad.next_renewal_date ? moment(ad.next_renewal_date) : null;
  const daysUntilRenewal = renewalDate ? renewalDate.diff(moment(), "days") : null;
  const withinCancellationWindow = daysUntilRenewal !== null && daysUntilRenewal < RENEWAL_CANCELLATION_WINDOW_DAYS;
  const resumeAutoRenewAllowed = ad.auto_renew === false && canResumeAutoRenew(ad);
  const daysUntilDeadline = daysUntilDate(renewalDeadline(ad));
  const nextTermEnd = renewalDate
    ? moment(renewalDate).add(1, ad.plan_type === "annual" ? "year" : "month").format("MMM D, YYYY")
    : null;
  const impressions = Number(ad.impressions || 0);
  const clicks = Number(ad.clicks || 0);
  const ctr = impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "0.0%";
  const billingLive = !!ad.stripe_subscription_id;
  const hasBillingAccount = Boolean(ad.stripe_customer_id);
  const upgradePending = Boolean(ad.upgrade_to_annual_pending);
  const downgradePending = Boolean(ad.downgrade_to_monthly_pending);
  const planChangePending = upgradePending || downgradePending;
  const targetPlanLabel = ad.plan_type === "annual" ? "Monthly" : "Annual";
  const planRate = formatAdPlanRate(ad);

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

  const handlePlanSwitch = async () => {
    if (ad.auto_renew === false) {
      toast({
        title: "Turn auto-renew back on first",
        description: "Plan switches apply at renewal, so auto-renew must be on.",
        variant: "destructive",
      });
      return;
    }
    setPlanSwitchLoading(true);
    try {
      const result = await requestAdPlanChange({ ad_id: ad.id, action: "request" });
      toast({
        title: `Switch to ${targetPlanLabel} scheduled`,
        description: result.message
          || `Takes effect at renewal${renewalDate ? ` (${renewalDate.format("MMM D, YYYY")})` : ""}. Check My Messages when the rate is locked in.`,
      });
      onRefresh?.();
    } catch (err) {
      toast({ title: "Could not schedule plan switch", description: err.message, variant: "destructive" });
    }
    setPlanSwitchLoading(false);
  };

  const handleCancelPlanSwitch = async () => {
    setPlanSwitchLoading(true);
    try {
      await requestAdPlanChange({ ad_id: ad.id, action: "cancel" });
      toast({ title: "Plan switch cancelled" });
      onRefresh?.();
    } catch (err) {
      toast({ title: "Could not cancel plan switch", description: err.message, variant: "destructive" });
    }
    setPlanSwitchLoading(false);
  };

  useEffect(() => {
    if (!ad.stripe_customer_id) {
      setCardLabel(null);
      return undefined;
    }
    let cancelled = false;
    setCardLoading(true);
    getAdPaymentMethod({ ad_id: ad.id })
      .then((card) => {
        if (!cancelled) setCardLabel(formatMaskedCard(card));
      })
      .catch(() => {
        if (!cancelled) setCardLabel(null);
      })
      .finally(() => {
        if (!cancelled) setCardLoading(false);
      });
    return () => { cancelled = true; };
  }, [ad.id, ad.stripe_customer_id]);

  const handleOpenBillingPortal = async () => {
    setPortalLoading(true);
    try {
      await openBillingPortalInNewTab({
        ad_id: ad.id,
        return_url: typeof window !== "undefined" ? window.location.href : undefined,
      });
    } catch (err) {
      toast({ title: "Could not open billing portal", description: err.message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleNonRenew = async () => {
    setNonRenewLoading(true);
    try {
      if (billingLive) {
        await cancelAdRenewal({ ad_id: ad.id });
      } else {
        const { error } = await supabase
          .from("banner_ads")
          .update({ auto_renew: false })
          .eq("id", ad.id)
          .eq("user_id", user.id);
        if (error) throw error;
      }
      toast({
        title: "Non-renew set",
        description: billingLive
          ? "Your ad will run until the end of the current term and will not be charged again."
          : "Your ad is marked non-renewing.",
      });
      setShowNonRenewConfirm(false);
      onRefresh?.();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setNonRenewLoading(false);
  };

  const handleResumeAutoRenew = async () => {
    setResumeRenewLoading(true);
    try {
      await resumeAdRenewal({ ad_id: ad.id });
      toast({
        title: "Auto-renew restored",
        description: renewalDate
          ? `Your ad will renew on ${renewalDate.format("MMM D, YYYY")} and continue billing after that.`
          : "Your ad will renew automatically at the end of the current term.",
      });
      setShowResumeRenewConfirm(false);
      onRefresh?.();
    } catch (err) {
      toast({ title: "Could not restore auto-renew", description: err.message, variant: "destructive" });
    }
    setResumeRenewLoading(false);
  };

  const renewalLine = (() => {
    if (!renewalDate && !ad.plan_end_date) return null;
    if (ad.auto_renew === false) {
      return (
        <span className="text-amber-700 font-medium">
          Ends {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : renewalDate?.format("MMM D, YYYY")} (no renewal)
        </span>
      );
    }
    if (renewalDate) return <span>Renews {renewalDate.format("MMM D, YYYY")}</span>;
    return null;
  })();

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex gap-3 items-start">
        {ad.image_url ? (
          <img
            src={ad.image_url}
            alt={ad.business_name}
            className="w-24 sm:w-28 aspect-[2/1] object-contain rounded-lg border border-border shrink-0 bg-muted/30"
          />
        ) : null}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-heading font-semibold text-sm">Zip {ad.zip_code}</h3>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
            {ad.auto_renew === false ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                Non-renewing
              </span>
            ) : null}
            {planChangePending ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                Switching to {upgradePending ? "Annual" : "Monthly"}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground truncate">{ad.business_name}</p>
          <p className="text-[11px] text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
            <span>
              {formatPlanTypeLabel(ad.plan_type)}
              {planRate ? ` · ${planRate}` : ""}
            </span>
            {ad.plan_start_date ? (
              <span>
                {moment(ad.plan_start_date).format("MMM D, YYYY")}
                {" → "}
                {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : "—"}
              </span>
            ) : null}
            {renewalLine}
            {ad.auto_renew !== false && renewalDate ? (
              <span className="w-full text-[10px] text-muted-foreground/90">
                Next renewal uses the published rate locked {RENEWAL_RATE_LOCK_DAYS} days before renewal.
              </span>
            ) : null}
          </p>
          {hasBillingAccount ? (
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 min-w-0">
              <CreditCard className="w-3 h-3 shrink-0 mt-0.5" />
              <span
                className="min-w-0 break-words"
                title={
                  cardLabel
                    ? undefined
                    : "Each zip has its own Stripe billing profile. Card details show when Stripe returns them."
                }
              >
                {cardLoading
                  ? "Loading card on file…"
                  : cardLabel || "Payment method on file"}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {hasBillingAccount ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-7 text-xs"
            disabled={portalLoading}
            onClick={handleOpenBillingPortal}
          >
            {portalLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CreditCard className="w-3 h-3 mr-1" />}
            Update Payment Method
          </Button>
        ) : null}
        {!showChangeCreative ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-7 text-xs"
            onClick={() => setShowChangeCreative(true)}
          >
            <ImagePlus className="w-3 h-3 mr-1" /> Change Creative
          </Button>
        ) : null}
        {planChangePending ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-7 text-xs"
            disabled={planSwitchLoading}
            onClick={handleCancelPlanSwitch}
          >
            {planSwitchLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
            Cancel Plan Switch
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-7 text-xs"
            disabled={planSwitchLoading || ad.auto_renew === false}
            onClick={handlePlanSwitch}
          >
            {planSwitchLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
            Switch To {targetPlanLabel}
          </Button>
        )}
        {ad.auto_renew !== false && !showNonRenewConfirm ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-7 text-xs"
            onClick={() => setShowNonRenewConfirm(true)}
          >
            <BellOff className="w-3 h-3 mr-1" /> Set Non-Renew
          </Button>
        ) : null}
        {ad.auto_renew === false && resumeAutoRenewAllowed && !showResumeRenewConfirm ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl h-7 text-xs border-mint-200 text-mint-700 hover:bg-mint-50"
            onClick={() => setShowResumeRenewConfirm(true)}
          >
            <RefreshCw className="w-3 h-3 mr-1" /> Turn Auto-Renew Back On
          </Button>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        {[
          { label: "Impressions", value: impressions.toLocaleString() },
          { label: "Clicks", value: clicks.toLocaleString() },
          { label: "CTR", value: ctr },
          { label: "Creative Flags", value: `${ad.flag_count || 0} of 3` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/40 rounded-lg px-1.5 py-1.5 text-center">
            <p className="font-heading font-bold text-xs sm:text-sm leading-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {planChangePending ? (
        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 text-[11px] text-blue-800">
          Switching to {upgradePending ? "Annual" : "Monthly"} at renewal
          {renewalDate ? <> (<strong>{renewalDate.format("MMM D, YYYY")}</strong>)</> : null}.
          You’ll get a My Messages notice when the rate is locked in (~21 days before renewal). The locked rate uses published pricing at that time — not the rate shown when you schedule the switch.
        </div>
      ) : null}

      {ad.auto_renew === false && !resumeAutoRenewAllowed && daysUntilDeadline !== null && daysUntilDeadline >= 0 ? (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[11px] text-amber-800">
          <p className="font-semibold">Auto-renew cannot be turned back on</p>
          <p className="mt-0.5">
            Your renewal is within {RENEWAL_CANCELLATION_WINDOW_DAYS} days
            {renewalDate ? <> (<strong>{renewalDate.format("MMM D, YYYY")}</strong>)</> : null}.
            This ad will end at the close of the current paid term.
          </p>
        </div>
      ) : null}

      {ad.auto_renew !== false && withinCancellationWindow ? (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 text-[11px] text-amber-800">
          <p className="font-semibold">
            Renewal in {daysUntilRenewal} day{daysUntilRenewal !== 1 ? "s" : ""} — cancellation window has passed
          </p>
          <p className="mt-0.5">
            Setting Non-renew now keeps the ad through the upcoming paid term (ends <strong>{nextTermEnd}</strong>).
          </p>
        </div>
      ) : null}

      {showChangeCreative ? (
        <div className="mt-2 bg-muted/30 border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold">Select an approved asset</p>
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
      ) : null}

      {showResumeRenewConfirm ? (
        <div className="mt-2 bg-mint-50 border border-mint-200 rounded-xl p-3 text-xs space-y-2">
          <p className="font-semibold text-mint-800">Turn auto-renew back on?</p>
          <p className="text-mint-700">
            Your ad will keep renewing
            {renewalDate ? (
              <>
                {" "}
                starting <strong>{renewalDate.format("MMM D, YYYY")}</strong>
              </>
            ) : (
              " at the end of the current term"
            )}
            . You can set non-renew again later, at least {RENEWAL_CANCELLATION_WINDOW_DAYS} days before renewal.
          </p>
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="rounded-xl h-7 text-xs bg-mint-500 hover:bg-mint-600 text-white"
              disabled={resumeRenewLoading}
              onClick={handleResumeAutoRenew}
            >
              {resumeRenewLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Confirm Auto-Renew
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl h-7 text-xs"
              onClick={() => setShowResumeRenewConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {showNonRenewConfirm ? (
        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
          {withinCancellationWindow && billingLive ? (
            <>
              <p className="font-semibold text-amber-800">Your next renewal charge cannot be avoided</p>
              <p className="text-amber-700">
                Because your renewal date (<strong>{renewalDate?.format("MMM D, YYYY")}</strong>) is within 14 days, the upcoming charge is committed. The ad stays active through that term and expires on <strong>{nextTermEnd}</strong>.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-amber-800">Confirm Non-Renew</p>
              <p className="text-amber-700">
                Your ad will continue until{" "}
                <strong>
                  {ad.plan_end_date
                    ? moment(ad.plan_end_date).format("MMM D, YYYY")
                    : renewalDate?.format("MMM D, YYYY") || "the end of the current term"}
                </strong>{" "}
                and will not renew.
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
              {withinCancellationWindow && billingLive ? "Understood — Set Non-Renew" : "Confirm Non-Renew"}
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
      ) : null}
    </div>
  );
}
