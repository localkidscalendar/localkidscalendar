import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, BarChart3, Eye, MousePointerClick, CheckCircle, RefreshCw, Images, List, Clock, Shield, ChevronDown, ChevronUp, ExternalLink, DollarSign, MapPin, AlertTriangle, Tag, Timer, BellOff, ImagePlus, TrendingUp, Trash2, PauseCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import moment from "moment";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdLibraryManager from "@/components/ads/AdLibraryManager";
import WaitlistManager from "@/components/ads/WaitlistManager";
import InactiveAdCard from "@/components/ads/InactiveAdCard";
import { SUPPORTER_RULES, TOS_INTRO, TOS_SECTIONS, TOS_FOOTER } from "@/lib/supporterContent";

const SLOT_HOLDING_STATUSES = ["active", "pending_payment", "pending_review", "flagged", "cancelled", "expired", "past_due"];
const RESERVATION_MINUTES = 10;

function RulesAndTerms() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);
  return (
    <div className="space-y-3">
      {/* Rules toggle */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
          onClick={() => setRulesOpen(o => !o)}
        >
          <span>Our Supporter Rules</span>
          {rulesOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {rulesOpen && (
          <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/20">
            {SUPPORTER_RULES.map((rule, idx) => (
              <div key={idx} className="flex gap-2">
                <span className="text-peach-400 font-bold shrink-0 mt-0.5">✦</span>
                <div>
                  <p className="font-semibold text-xs mb-0.5">{rule.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{rule.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* TOS toggle */}
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
          onClick={() => setTosOpen(o => !o)}
        >
          <span>Supporter Terms of Service</span>
          {tosOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {tosOpen && (
          <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4 text-xs text-muted-foreground">
            <p className="leading-relaxed">{TOS_INTRO}</p>

            {TOS_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="font-heading font-bold text-sm mb-1">{section.title}</h3>
                {section.paragraphs.map((p, i) => (
                  <p key={i} className={`leading-relaxed ${section.emphasis ? "font-medium border-l-4 border-peach-300 pl-3" : ""} ${i > 0 ? "mt-2" : ""}`}>
                    {p}
                  </p>
                ))}
                {section.list && (
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    {section.list.map((item, i) => (
                      <li key={i}><strong>{item.label}:</strong> {item.text}</li>
                    ))}
                  </ul>
                )}
                {section.afterListParagraphs?.map((p, i) => (
                  <p key={i} className="leading-relaxed mt-2">{p}</p>
                ))}
              </div>
            ))}

            <p className="pt-3 border-t border-border text-xs">{TOS_FOOTER}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CurrentRates() {
  const [pricing, setPricing] = useState(null);
  useEffect(() => {
    base44.entities.AdPricingConfig.filter({ config_key: "global" })
      .then(c => { if (c.length > 0) setPricing(c[0]); }).catch(() => {});
  }, []);

  if (!pricing) return null;
  const annualPrice = Math.round(pricing.monthly_rate * 12 * (1 - pricing.annual_discount_percent / 100));
  const annualMonthly = (annualPrice / 12).toFixed(2);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-muted/30 rounded-xl p-4 text-center">
          <p className="font-heading font-bold text-2xl">${pricing.monthly_rate}</p>
          <p className="text-xs text-muted-foreground font-medium">per month / per zip code</p>
        </div>
        <div className="bg-mint-50 border border-mint-200 rounded-xl p-4 text-center relative">
          <div className="text-xs font-bold text-peach-500 mb-1">⭐ Best Value</div>
          <p className="font-heading font-bold text-2xl">${annualPrice.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground font-medium">per year / per zip code</p>
          <p className="text-xs text-mint-600 mt-1">(~${annualMonthly}/mo — save {pricing.annual_discount_percent}%)</p>
        </div>
      </div>
      <div className="bg-muted/20 rounded-xl p-4 text-xs text-muted-foreground space-y-1.5">
        <p className="font-semibold text-foreground text-sm mb-2">Renewal Policy</p>
        <p>• Plans automatically renew for the same period at the <strong>current ad rate as of 21 days before renewal</strong>.</p>
        <p>• To avoid renewal, you must cancel at least <strong>14 days before your renewal date</strong>.</p>
        <p>• Renewal charges are processed automatically via your payment method on file.</p>
        <p>• Rate changes announced before the 21-day window will apply to your next renewal cycle.</p>
      </div>
    </div>
  );
}

// ── Status badge config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:          { label: "Active",             color: "bg-mint-100 text-mint-600" },
  pending_review:  { label: "Pending Review",      color: "bg-blue-100 text-blue-600" },
  pending_payment: { label: "Pending Payment",     color: "bg-yellow-100 text-yellow-600" },
  past_due:        { label: "Payment Past Due",    color: "bg-orange-100 text-orange-600" },
  rejected:        { label: "Rejected",            color: "bg-red-100 text-red-600" },
  expired:         { label: "Paused/Deactivated",  color: "bg-gray-100 text-gray-500" },
  cancelled:       { label: "Paused/Deactivated",  color: "bg-gray-100 text-gray-500" },
  flagged:         { label: "Flagged",             color: "bg-peach-100 text-peach-600" },
};

const STATUS_MESSAGES = {
  past_due: {
    bg: "bg-orange-50 border-orange-200", textColor: "text-orange-700",
    title: "Payment past due — your ad is temporarily hidden.",
    body: "We couldn't process your renewal payment. Your spot is still reserved for 7 days. Please update your payment method to restore your ad.",
  },
  expired: {
    bg: "bg-gray-50 border-gray-200", textColor: "text-gray-700",
    title: "Your ad has been paused by our team.",
    body: "Your subscription remains active. Submit a replacement to resume.",
  },
  flagged: {
    bg: "bg-peach-50 border-peach-200", textColor: "text-peach-700",
    title: "Your ad has been flagged for review.",
    body: "Our team flagged your ad for a policy concern. Submit a replacement that meets our community standards.",
  },
  rejected: {
    bg: "bg-red-50 border-red-200", textColor: "text-red-700",
    title: "Your ad was not approved.",
    body: "Your subscription remains active. See the reason below and submit a corrected replacement.",
  },
};

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="font-heading font-bold text-2xl">{value}</p>
    </div>
  );
}

// ── Ad card with Non-renew and replacement actions ──────────────────────────
function AdCard({ ad, user, onRefresh }) {
  const [showReplaceForm, setShowReplaceForm] = useState(false);
  const [showNonRenewConfirm, setShowNonRenewConfirm] = useState(false);
  const [nonRenewLoading, setNonRenewLoading] = useState(false);
  const [showChangeCreative, setShowChangeCreative] = useState(false);
  const [creativeLoading, setCreativeLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [adminDeleting, setAdminDeleting] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const cfg = STATUS_CONFIG[ad.status] || STATUS_CONFIG.pending_review;
  const msg = STATUS_MESSAGES[ad.status];

  // 14-day cancellation deadline logic
  const renewalDate = ad.next_renewal_date ? moment(ad.next_renewal_date) : null;
  const daysUntilRenewal = renewalDate ? renewalDate.diff(moment(), "days") : null;
  const withinCancellationWindow = daysUntilRenewal !== null && daysUntilRenewal < 14;
  const nextTermEnd = renewalDate
    ? moment(renewalDate).add(1, ad.plan_type === "annual" ? "year" : "month").format("MMM D, YYYY")
    : null;

  const handleNonRenew = async () => {
    setNonRenewLoading(true);
    try {
      const res = await base44.functions.invoke("cancelAdRenewal", { ad_id: ad.id });
      if (res.data?.success) {
        toast({ title: "Non-renew set", description: "Your ad will run until the end of the current term and will not be charged again." });
        setShowNonRenewConfirm(false);
        onRefresh();
      } else {
        throw new Error(res.data?.error || "Failed to cancel renewal");
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setNonRenewLoading(false);
  };

  const handleChangeCreative = async (asset) => {
    setCreativeLoading(true);
    try {
      const res = await base44.functions.invoke("updateAdCreative", { ad_id: ad.id, ad_library_id: asset.id });
      if (res.data?.success) {
        toast({ title: "Ad creative updated" });
        setShowChangeCreative(false);
        onRefresh();
      } else {
        throw new Error(res.data?.error || "Failed to update creative");
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCreativeLoading(false);
  };

  const handlePlanUpgradeAction = async (action) => {
    setPlanLoading(true);
    try {
      const res = await base44.functions.invoke("requestAdPlanUpgrade", { ad_id: ad.id, action });
      if (res.data?.success) {
        toast({ title: action === "request" ? "Upgrade scheduled" : "Upgrade cancelled", description: res.data.message });
        onRefresh();
      } else {
        throw new Error(res.data?.error || "Failed to update plan");
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setPlanLoading(false);
  };

  const handleAdminDelete = async () => {
    if (!window.confirm(`Delete this ad for zip ${ad.zip_code} and release the zip code slot? There is no payment/subscription to cancel, so this permanently removes the ad. This cannot be undone.`)) return;
    setAdminDeleting(true);
    try {
      await base44.entities.BannerAd.delete(ad.id);
      base44.functions.invoke("processWaitlist", {}).catch(() => {});
      toast({ title: "Ad deleted", description: `Zip code ${ad.zip_code} has been released.` });
      onRefresh();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setAdminDeleting(false);
    }
  };

  const handleUpdatePaymentMethod = async () => {
    setPortalLoading(true);
    try {
      const res = await base44.functions.invoke("createBillingPortalSession", { ad_id: ad.id });
      if (res.data?.url) window.location.href = res.data.url;
      else throw new Error(res.data?.error || "Could not open billing portal");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setPortalLoading(false);
    }
  };

  const handleCheckoutForReplacement = async () => {
    if (window.self !== window.top) {
      alert("Checkout is only available from the published app. Please open the app in a new tab.");
      return;
    }
    try {
      const res = await base44.functions.invoke("createAdCheckout", {
        plan_type: ad.plan_type,
        zip_code: ad.zip_code,
        business_name: ad.business_name,
        link_url: ad.link_url,
        image_url: ad.image_url || null,
        success_url: `${window.location.origin}/ad-manager?success=true`,
        cancel_url: `${window.location.origin}/ad-manager?cancelled=true`,
      });
      if (res.data?.url) window.location.href = res.data.url;
      else throw new Error(res.data?.error || "Checkout failed");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.business_name} className="w-full sm:w-32 h-20 object-cover rounded-xl border border-border shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-heading font-semibold">Zip {ad.zip_code}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            {ad.auto_renew === false && ad.status === "active" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Non-renewing</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-1">
            <span>{ad.business_name}</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            <span className="capitalize">{ad.plan_type} plan</span>
            {ad.plan_start_date && <span>{moment(ad.plan_start_date).format("MMM D, YYYY")} → {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : "—"}</span>}
            {renewalDate && ad.status === "active" && ad.auto_renew !== false && (
              <span>Renews {renewalDate.format("MMM D, YYYY")}</span>
            )}
            {renewalDate && ad.status === "active" && ad.auto_renew === false && (
              <span className="text-amber-600 font-medium">Ends {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : renewalDate.format("MMM D, YYYY")} (no renewal)</span>
            )}
          </div>

          {/* 14-day renewal window warning for active auto-renewing ads */}
          {ad.status === "active" && ad.auto_renew !== false && withinCancellationWindow && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-3">
              <p className="font-semibold mb-0.5">⚠️ Renewal in {daysUntilRenewal} day{daysUntilRenewal !== 1 ? "s" : ""} — cancellation window has passed</p>
              <p>Your next renewal charge is committed. If you set Non-renew now, your ad will continue through the upcoming paid term and expire at the end of it (<strong>{nextTermEnd}</strong>).</p>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: "Impressions", value: (ad.impressions || 0).toLocaleString() },
              { label: "Clicks",      value: (ad.clicks || 0).toLocaleString() },
              { label: "CTR",         value: ad.impressions > 0 ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : "—" },
              { label: "Flags",       value: `${ad.flag_count || 0} of 3` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-2 text-center">
                <p className="font-heading font-bold text-sm">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Change Creative — for any active ad */}
          {ad.status === "active" && (
            <div className="mb-3">
              {!showChangeCreative ? (
                <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs mr-2" onClick={() => setShowChangeCreative(true)}>
                  <ImagePlus className="w-3 h-3 mr-1" /> Change Creative
                </Button>
              ) : (
                <div className="bg-muted/30 border border-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold">Select an approved asset to use for this ad</p>
                    <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={() => setShowChangeCreative(false)} disabled={creativeLoading}>Cancel</Button>
                  </div>
                  {creativeLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-mint-500" /></div>
                  ) : (
                    <AdLibraryManager user={user} onSelectAsset={handleChangeCreative} />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Plan change — active ads only */}
          {ad.status === "active" && ad.plan_type === "monthly" && (
            <div className="mb-3">
              {ad.upgrade_to_annual_pending ? (
                <div className="bg-mint-50 border border-mint-200 rounded-xl p-3 text-xs flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-mint-700"><TrendingUp className="w-3 h-3 inline mr-1" />Scheduled to switch to Annual at next renewal.</span>
                  <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" disabled={planLoading} onClick={() => handlePlanUpgradeAction("cancel")}>
                    {planLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel"}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs" disabled={planLoading} onClick={() => handlePlanUpgradeAction("request")}>
                  {planLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                  Switch to Annual at Renewal
                </Button>
              )}
            </div>
          )}
          {ad.status === "active" && ad.plan_type === "annual" && (
            <div className="mb-3">
              {ad.downgrade_to_monthly_pending ? (
                <div className="bg-mint-50 border border-mint-200 rounded-xl p-3 text-xs flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-mint-700"><TrendingUp className="w-3 h-3 inline mr-1" />Scheduled to switch to Monthly at next renewal.</span>
                  <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" disabled={planLoading} onClick={() => handlePlanUpgradeAction("cancel")}>
                    {planLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cancel"}
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs" disabled={planLoading} onClick={() => handlePlanUpgradeAction("request")}>
                  {planLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                  Switch to Monthly at Renewal
                </Button>
              )}
            </div>
          )}

          {/* Non-renew button — only for active, auto-renewing ads with a Stripe subscription */}
          {ad.status === "active" && ad.auto_renew !== false && ad.stripe_subscription_id && (
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
                  {withinCancellationWindow ? (
                    <>
                      <p className="font-semibold text-amber-800">⚠️ Your next renewal charge cannot be avoided</p>
                      <p className="text-amber-700">
                        Because your renewal date (<strong>{renewalDate?.format("MMM D, YYYY")}</strong>) is within 14 days, the upcoming charge has already been committed by our payment processor.
                      </p>
                      <p className="text-amber-700">
                        Your ad will remain active through that paid term and will automatically expire on <strong>{nextTermEnd}</strong>, at which point the zip code slot will be released.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-amber-800">Confirm Non-renew</p>
                      <p className="text-amber-700">
                        Your ad will continue running until <strong>{ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : renewalDate?.format("MMM D, YYYY")}</strong> and will not be charged again. The zip code slot will be released when your term ends.
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
                      {withinCancellationWindow ? "Understood — Set Non-renew" : "Confirm Non-renew"}
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={() => setShowNonRenewConfirm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {user?.role === "admin" && (
            <div className="mb-3">
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

          {msg && (
            <div className={`p-3 rounded-xl border text-xs ${msg.bg} ${msg.textColor}`}>
              <p className="font-semibold mb-1">{msg.title}</p>
              <p className="mb-2">{msg.body}</p>
              {ad.moderation_notes && <p className="mb-2"><strong>Note:</strong> {ad.moderation_notes}</p>}
              {ad.status === "past_due" ? (
                <button
                  onClick={handleUpdatePaymentMethod}
                  disabled={portalLoading}
                  className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors disabled:opacity-60"
                >
                  {portalLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                  Update Payment Method
                </button>
              ) : showReplaceForm ? (
                <div className="mt-2 bg-white rounded-xl p-3 border border-border">
                  <p className="text-xs text-muted-foreground mb-2">To submit a replacement ad, proceed to checkout and complete a new subscription for this zip code.</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white text-xs h-7" onClick={handleCheckoutForReplacement}>
                      Start New Subscription →
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={() => setShowReplaceForm(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white mt-1 text-xs h-7" onClick={() => setShowReplaceForm(true)}>
                  Submit Replacement Ad
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Countdown Timer Banner ────────────────────────────────────────────────────
function CountdownBanner({ expiresAt, onExpired }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    if (secondsLeft <= 0) { onExpired(); return; }
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) { clearInterval(interval); onExpired(); }
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 120;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium ${isUrgent ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
      <Timer className={`w-4 h-4 shrink-0 ${isUrgent ? "text-red-500" : "text-amber-500"}`} />
      <div className="flex-1">
        <span className="font-semibold">Spot reserved — </span>
        <span>{isUrgent ? "Hurry! " : ""}Complete checkout within </span>
        <span className={`font-mono font-bold text-base ${isUrgent ? "text-red-600" : "text-amber-600"}`}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

// ── New Ad submission form (using Ad Library) ────────────────────────────────
function NewAdForm({ user, onSuccess, onCancel, prefill, onGoToLibrary }) {
  const [pricing, setPricing] = useState({ monthly_rate: 150, annual_discount_percent: 30 });
  // Steps: 1=zip check, 2=creative, 3=plan, 4=review
  const [step, setStep] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [form, setForm] = useState({
    zip_code: prefill?.zip_code || "",
    plan_type: prefill?.plan_type || "monthly",
    discount_code: "",
  });
  const [zipChecking, setZipChecking] = useState(false);
  const [zipStatus, setZipStatus] = useState(null);
  const [reservationExpiry, setReservationExpiry] = useState(null); // ms timestamp
  const [reservationId, setReservationId] = useState(null);
  const [expired, setExpired] = useState(false);
  const [discountValid, setDiscountValid] = useState(null);
  const [discountPercent, setDiscountPercent] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [approvedAssets, setApprovedAssets] = useState(null); // null=loading, array=loaded

  useEffect(() => {
    base44.entities.AdPricingConfig.filter({ config_key: "global" })
      .then(c => { if (c.length > 0) setPricing(c[0]); }).catch(() => {});
  }, []);

  // If prefilled from waitlist, skip to step 2 and create reservation
  useEffect(() => {
    if (prefill?.zip_code) {
      handleZipConfirmed(prefill.zip_code);
    }
  }, []);

  const annualPrice = Math.round(pricing.monthly_rate * 12 * (1 - pricing.annual_discount_percent / 100));

  const checkZipAvailability = async () => {
    const zip = form.zip_code.trim();
    if (zip.length !== 5) return;
    setZipChecking(true);
    setZipStatus(null);
    try {
      const [zipConfigs, existingAds] = await Promise.all([
        base44.entities.AdZipConfig.filter({ zip_code: zip }),
        base44.entities.BannerAd.filter({ zip_code: zip }),
      ]);
      const maxSlots = zipConfigs.length > 0 ? zipConfigs[0].max_slots : 3;
      const holding = existingAds.filter(ad => SLOT_HOLDING_STATUSES.includes(ad.status));
      const userAlreadyHasAd = holding.some(ad => ad.user_id === user.id);
      setZipStatus({ available: holding.length < maxSlots && !userAlreadyHasAd, slots_total: maxSlots, slots_used: holding.length, userAlreadyHasAd });
    } catch {
      setZipStatus({ available: false, error: true });
    }
    setZipChecking(false);
  };

  const handleZipConfirmed = async (zip) => {
    const targetZip = zip || form.zip_code;
    // Create a 15-min reservation
    const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000).toISOString();
    try {
      const reservation = await base44.entities.ZipCodeReservation.create({
        user_id: user.id,
        zip_code: targetZip,
        expires_at: expiresAt,
        status: "active",
      });
      setReservationId(reservation.id);
    } catch { /* non-blocking — reservation is advisory */ }
    setReservationExpiry(Date.now() + RESERVATION_MINUTES * 60 * 1000);
    setExpired(false);

    // Load approved assets count for warning
    base44.entities.AdLibrary.filter({ user_id: user.id, moderation_status: "approved" })
      .then(assets => setApprovedAssets(assets))
      .catch(() => setApprovedAssets([]));

    setStep(2);
  };

  const handleExpired = useCallback(async () => {
    setExpired(true);
    if (reservationId) {
      base44.entities.ZipCodeReservation.update(reservationId, { status: "expired" }).catch(() => {});
    }
    toast({ title: "Reservation expired", description: "Your spot hold timed out. Please start over to check availability again.", variant: "destructive" });
  }, [reservationId]);

  const checkDiscount = async () => {
    if (!form.discount_code.trim()) return;
    const codes = await base44.entities.DiscountCode.filter({ code: form.discount_code.toUpperCase(), status: "active" });
    const dc = codes[0];
    const valid = !!dc && (!dc.restricted_email || dc.restricted_email.toLowerCase() === (user.email || "").toLowerCase());
    setDiscountValid(valid);
    setDiscountPercent(valid ? dc.discount_percent : null);
  };

  const handleCheckout = async () => {
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("createAdCheckout", {
        plan_type: form.plan_type,
        zip_code: form.zip_code,
        business_name: selectedAsset.ad_name,
        link_url: selectedAsset.link_url,
        image_url: selectedAsset.image_url,
        ad_library_id: selectedAsset.id,
        discount_code: form.discount_code || null,
        waitlist_entry_id: prefill?.waitlist_entry_id || null,
        success_url: `${window.location.origin}/ad-manager?success=true`,
        cancel_url: `${window.location.origin}/ad-manager?cancelled=true`,
      });
      // Mark reservation completed
      if (reservationId) base44.entities.ZipCodeReservation.update(reservationId, { status: "completed" }).catch(() => {});
      // Admin bypass: no Stripe URL, ad is already live
      if (res.data?.admin_bypass) {
        if (reservationId) base44.entities.ZipCodeReservation.update(reservationId, { status: "completed" }).catch(() => {});
        toast({ title: "Ad published! 🎉", description: "Your ad is now live (admin override — no payment required)." });
        onSuccess();
        return;
      }
      if (res.data?.url) {
        if (window.self !== window.top) {
          alert("Checkout is only available from the published app. Please open the app in a new tab.");
          setSubmitting(false);
          return;
        }
        window.location.href = res.data.url;
      }
      else throw new Error(res.data?.error || "Checkout failed");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setSubmitting(false);
    }
  };

  const STEP_LABELS = ["Zip Code", "Creative", "Plan", "Review", "Payment"];

  // If expired, show reset screen
  if (expired) {
    return (
      <div className="bg-white rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold">Submit a New Ad</h2>
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={onCancel}>Cancel</Button>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-3">
          <Timer className="w-8 h-8 text-red-400 mx-auto" />
          <p className="font-heading font-semibold text-red-700">Your reservation expired</p>
          <p className="text-sm text-muted-foreground">Your {RESERVATION_MINUTES}-minute spot hold for zip <strong>{form.zip_code}</strong> has timed out. The spot may now be available to others.</p>
          <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => { setStep(1); setExpired(false); setZipStatus(null); setReservationExpiry(null); setReservationId(null); setSelectedAsset(null); }}>
            Start Over — Check Availability Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-semibold">Submit a New Ad</h2>
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={onCancel}>Cancel</Button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-1.5 font-medium ${step === i + 1 ? "text-mint-500" : step > i + 1 ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
              <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${step === i + 1 ? "bg-mint-500 text-white" : step > i + 1 ? "bg-mint-100 text-mint-500" : "bg-muted text-muted-foreground"}`}>
                {step > i + 1 ? "✓" : i + 1}
              </div>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </React.Fragment>
        ))}
      </div>

      {/* Countdown banner — shown on steps 2, 3, 4 */}
      {reservationExpiry && step > 1 && (
        <CountdownBanner expiresAt={reservationExpiry} onExpired={handleExpired} />
      )}

      {/* Step 1: Zip Code check */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">See if the zip code is available for advertising *</label>
            <div className="flex gap-2 mt-1">
              <input
                className="w-32 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="89448" maxLength={5} value={form.zip_code}
                onChange={e => { setForm(f => ({ ...f, zip_code: e.target.value.replace(/\D/g, "") })); setZipStatus(null); }}
                onKeyDown={e => { if (e.key === "Enter" && form.zip_code.length === 5) checkZipAvailability(); }}
              />
              <Button className="rounded-xl shrink-0 bg-mint-500 hover:bg-mint-600 text-white" disabled={form.zip_code.length !== 5 || zipChecking} onClick={checkZipAvailability}>
                {zipChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Your ad will show to families whose zip code — either their profile zip or a zip they've manually entered — exactly matches this one. There is no surrounding mile radius; only this exact zip code is targeted.</p>
          </div>

          {zipStatus && (
            <div className={`rounded-2xl p-4 text-sm ${zipStatus.available ? "bg-mint-50 border border-mint-200" : "bg-red-50 border border-red-200"}`}>
              {zipStatus.error ? (
                <div className="flex items-center gap-2 text-red-700"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Could not check availability. Please try again.</span></div>
              ) : zipStatus.available ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-mint-600">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span><span className="font-semibold">Spot available!</span> {zipStatus.slots_used} of {zipStatus.slots_total} spots filled in {form.zip_code}.</span>
                  </div>
                  <p className="text-xs text-mint-700 pl-6">Confirming this zip will hold your spot for {RESERVATION_MINUTES} minutes while you complete checkout.</p>
                </div>
              ) : zipStatus.userAlreadyHasAd ? (
                <div className="flex items-start gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">You already have an ad for {form.zip_code}</p>
                    <p className="text-xs mt-1">Only one ad per zip code is allowed per Supporter.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">No slots available in {form.zip_code}</p>
                    <p className="text-xs mt-1">All {zipStatus.slots_total} spots are filled. Join the waitlist from the Waitlist tab.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white" disabled={!zipStatus?.available} onClick={() => handleZipConfirmed()}>
            <MapPin className="w-4 h-4 mr-1" /> Confirm {form.zip_code} & Start {RESERVATION_MINUTES}-Min Hold →
          </Button>

          {/* Before you start — shown after zip input, below the continue button */}
          <div className="bg-muted/30 rounded-2xl p-4 text-xs text-muted-foreground space-y-1.5 border border-border">
            <p className="font-semibold text-foreground text-sm mb-2">Before you start — have these ready:</p>
            <p>✦ An <strong>approved ad creative</strong> from your <button type="button" onClick={onGoToLibrary} className="text-mint-500 underline font-semibold">Ad Library</button> (image + destination URL pre-approved)</p>
            <p>✦ Your <strong>payment method</strong> for the Stripe checkout</p>
            <p>✦ Once you confirm a zip code, you'll have <strong>{RESERVATION_MINUTES} minutes</strong> to complete checkout before the spot is released</p>
            <p>✦ Please review our <a href="/supporters" target="_blank" className="text-mint-500 underline">Supporter Community Rules</a> and <a href="/advertiser-terms" target="_blank" className="text-mint-500 underline">Terms & Conditions</a> before proceeding</p>
          </div>
        </div>
      )}

      {/* Step 2: Creative selection */}
      {step === 2 && (
        <div className="space-y-3">
          {/* No approved assets warning */}
          {approvedAssets !== null && approvedAssets.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">No approved creatives yet</p>
                <p className="text-xs text-amber-700 mt-1">You don't have any pre-approved assets in your Ad Library. You can upload a new one below, but it will need to pass AI moderation before you can proceed — this may take a moment. <strong>Your timer is running.</strong></p>
              </div>
            </div>
          )}

          {selectedAsset && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-mint-50 border border-mint-200">
              {selectedAsset.image_url && <img src={selectedAsset.image_url} alt="" className="w-14 h-9 object-cover rounded-lg border border-mint-200 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{selectedAsset.ad_name}</p>
                <p className="text-xs text-mint-600">Selected ✓</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs rounded-xl" onClick={() => setSelectedAsset(null)}>Change</Button>
            </div>
          )}
          <AdLibraryManager user={user} onSelectAsset={asset => setSelectedAsset(asset)} />
          <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl px-3 py-2 border border-border">
            💡 <strong>Not sure which creative to use?</strong> Don't worry — you can swap the ad creative associated with any active zip code at any time from your Ad Manager, as long as the replacement is pre-approved.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl flex-1" onClick={() => { setStep(1); setReservationExpiry(null); setReservationId(null); setZipStatus(null); }}>← Back</Button>
            <Button className="flex-1 rounded-xl bg-mint-500 hover:bg-mint-600 text-white" disabled={!selectedAsset} onClick={() => setStep(3)}>
              Next: Choose Plan →
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Plan + discount */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const discountedMonthly = discountValid && discountPercent != null ? Math.round(pricing.monthly_rate * (1 - discountPercent / 100)) : null;
              const discountedAnnual = discountValid && discountPercent != null ? Math.round(annualPrice * (1 - discountPercent / 100)) : null;
              return [
                { id: "monthly", label: "Monthly", price: `$${pricing.monthly_rate}/mo`, discountedPrice: discountedMonthly != null ? `$${discountedMonthly}/mo` : null, desc: "Flexible, cancel anytime." },
                { id: "annual",  label: "Annual",  price: `$${annualPrice.toLocaleString()}/yr`, discountedPrice: discountedAnnual != null ? `$${discountedAnnual.toLocaleString()}/yr` : null, desc: `Save ${pricing.annual_discount_percent}% — best value.`, highlight: true },
              ].map(plan => (
                <button key={plan.id} onClick={() => setForm(f => ({ ...f, plan_type: plan.id }))}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${form.plan_type === plan.id ? "border-mint-500 bg-mint-50" : "border-border bg-white hover:border-mint-200"}`}>
                  {plan.highlight && <div className="text-xs font-bold text-peach-500 mb-1">⭐ Best Value</div>}
                  {plan.discountedPrice ? (
                    <div className="flex items-baseline gap-2">
                      <div className="font-heading font-bold text-lg text-mint-600">{plan.discountedPrice}</div>
                      <div className="font-heading text-sm text-muted-foreground line-through">{plan.price}</div>
                    </div>
                  ) : (
                    <div className="font-heading font-bold text-lg">{plan.price}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">{plan.desc}</div>
                </button>
              ));
            })()}
          </div>
          <div>
            <label className="text-sm font-medium flex items-center gap-1"><Tag className="w-3 h-3" /> Discount Code (optional)</label>
            <div className="flex gap-2 mt-1">
              <input className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="SUMMER25" value={form.discount_code}
                onChange={e => { setForm(f => ({ ...f, discount_code: e.target.value })); setDiscountValid(null); setDiscountPercent(null); }} />
              <Button variant="outline" className="rounded-xl shrink-0" onClick={checkDiscount}>Apply</Button>
            </div>
            {discountValid === true && <p className="text-xs text-mint-500 mt-1">✓ Discount applied at checkout!</p>}
            {discountValid === false && <p className="text-xs text-destructive mt-1">Code not found or already used.</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl flex-1" onClick={() => setStep(2)}>← Back</Button>
            <Button className="flex-1 rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => setStep(4)}>Next: Review →</Button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Pay */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-2xl p-4 space-y-2 text-sm">
            {selectedAsset?.image_url && <img src={selectedAsset.image_url} alt="" className="w-full max-h-32 object-cover rounded-xl mb-3" />}
            <div className="flex justify-between"><span className="text-muted-foreground">Creative</span><span className="font-medium">{selectedAsset?.ad_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Destination</span><span className="font-medium truncate max-w-[200px]">{selectedAsset?.link_url}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Zip Code</span><span className="font-medium">{form.zip_code}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium capitalize">{form.plan_type} — {form.plan_type === "annual" ? `$${annualPrice.toLocaleString()}/yr` : `$${pricing.monthly_rate}/mo`}</span></div>
            {discountValid && form.discount_code && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-medium text-mint-500">{form.discount_code.toUpperCase()} ({discountPercent}% off)</span></div>}
            {discountValid && form.discount_code && discountPercent != null && (() => {
              const basePrice = form.plan_type === "annual" ? annualPrice : pricing.monthly_rate;
              const netAmount = Math.round(basePrice * (1 - discountPercent / 100));
              return (
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground font-medium">Net Amount Due</span>
                  <span className="font-semibold text-foreground">${netAmount.toLocaleString()}{form.plan_type === "annual" ? "/yr" : "/mo"}</span>
                </div>
              );
            })()}
          </div>
          <p className="text-xs text-muted-foreground">By proceeding, you agree to the <a href="/advertiser-terms" target="_blank" className="text-mint-500 underline">Supporter Terms & Conditions</a>.</p>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl flex-1" onClick={() => setStep(3)}>← Back</Button>
            <Button className="flex-1 rounded-xl bg-peach-400 hover:bg-peach-500 text-white font-semibold" disabled={submitting} onClick={handleCheckout}>
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting…</> : "Pay & Go Live →"}
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">Secure payment via Stripe. Auto-renews unless cancelled.</p>
        </div>
      )}
    </div>
  );
}

// ── Main AdManager page ──────────────────────────────────────────────────────
export default function AdManager() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [ads, setAds] = useState([]);
  const [adsLoading, setAdsLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [waitlistPrefill, setWaitlistPrefill] = useState(null); // { zip_code, plan_type, waitlist_entry_id }
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("ads");

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setAuthLoading(false); }).catch(() => { setAuthLoading(false); });
  }, []);

  useEffect(() => {
    if (user) loadAds();
  }, [user]);

  // Show success/cancel toasts from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast({ title: "Payment successful! 🎉", description: "Your ad is now being reviewed and will go live shortly." });
      window.history.replaceState({}, "", "/ad-manager");
    } else if (params.get("cancelled") === "true") {
      toast({ title: "Checkout cancelled", variant: "destructive" });
      window.history.replaceState({}, "", "/ad-manager");
    }
  }, []);

  const loadAds = async ({ silent } = {}) => {
    if (silent) setRefreshing(true); else setAdsLoading(true);
    try {
      const results = await base44.entities.BannerAd.filter({ user_id: user.id }, "-created_date", 50);
      setAds(results);
      if (silent) toast({ title: "Ads refreshed" });
    } catch {
      setAds([]);
      if (silent) toast({ title: "Refresh failed", variant: "destructive" });
    }
    if (silent) setRefreshing(false); else setAdsLoading(false);
  };

  const handleCheckoutForWaitlistEntry = (entry) => {
    setWaitlistPrefill({ zip_code: entry.zip_code, plan_type: entry.plan_type, waitlist_entry_id: entry.id });
    setShowNewForm(true);
    toast({ title: `Claiming spot for zip ${entry.zip_code}`, description: "Select your ad creative to proceed." });
  };

  if (authLoading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
    </div>
  );

  if (!user) return (
    <div className="max-w-md mx-auto mt-20 text-center px-4">
      <h1 className="font-heading font-bold text-2xl mb-3">Ad Manager</h1>
      <p className="text-muted-foreground mb-6">Please log in to manage your Supporter ads.</p>
      <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => window.location.href = "/login"}>Log In</Button>
    </div>
  );

  const activeAds = ads.filter(a => a.status === "active");
  const totalImpressions = ads.reduce((s, a) => s + (a.impressions || 0), 0);
  const totalClicks = ads.reduce((s, a) => s + (a.clicks || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl">Ad Manager</h1>
          <p className="text-sm text-muted-foreground">Manage your Supporter advertising campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" disabled={refreshing} onClick={() => loadAds({ silent: true })}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />Refresh
          </Button>
          {!showNewForm && <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => setShowNewForm(true)}>+ New Ad</Button>}
        </div>
      </div>

      {showNewForm ? (
        <div className="mb-6">
          <NewAdForm
            user={user}
            prefill={waitlistPrefill}
            onSuccess={() => { setShowNewForm(false); setWaitlistPrefill(null); loadAds(); }}
            onCancel={() => { setShowNewForm(false); setWaitlistPrefill(null); }}
            onGoToLibrary={() => { setShowNewForm(false); setWaitlistPrefill(null); setActiveTab("library"); }}
          />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Eye}              label="Total Impressions"  value={totalImpressions.toLocaleString()} />
            <StatCard icon={MousePointerClick} label="Total Clicks"       value={totalClicks.toLocaleString()} />
            <StatCard icon={BarChart3}         label="Click-Through Rate" value={`${ctr}%`} />
            <StatCard icon={CheckCircle}       label="Active Ads"         value={activeAds.length} />
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="rounded-xl mb-4">
              <TabsTrigger value="ads" className="rounded-lg flex items-center gap-1.5"><List className="w-3.5 h-3.5" />My Ads ({ads.length})</TabsTrigger>
              <TabsTrigger value="library" className="rounded-lg flex items-center gap-1.5"><Images className="w-3.5 h-3.5" />Ad Library</TabsTrigger>
              <TabsTrigger value="waitlist" className="rounded-lg flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Waitlist</TabsTrigger>
              <TabsTrigger value="rules" className="rounded-lg flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />Rules & Terms</TabsTrigger>
              <TabsTrigger value="rates" className="rounded-lg flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" />Current Ad Rates</TabsTrigger>
            </TabsList>

            <TabsContent value="ads">
              {adsLoading ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-mint-500" /></div>
              ) : ads.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-border">
                  <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="font-heading font-semibold mb-1">No ads yet</p>
                  <p className="text-sm text-muted-foreground mb-4">Submit your first Supporter ad to reach local families.</p>
                  <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => setShowNewForm(true)}>Submit Your First Ad</Button>
                </div>
              ) : (
                (() => {
                  const activeAds = ads.filter(a => a.status === "active");
                  const inactiveAds = ads
                    .filter(a => a.status !== "active")
                    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
                  return (
                    <div className="space-y-8">
                      <div>
                        <AdminSectionHeader title="My Active Ads" icon={CheckCircle} />
                        <div className="bg-white rounded-2xl border border-border p-5">
                          {activeAds.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No active ads.</p>
                          ) : (
                            <div className="space-y-4">
                              {activeAds.map(ad => <AdCard key={ad.id} ad={ad} user={user} onRefresh={loadAds} />)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <AdminSectionHeader title="My Inactive Ads" icon={PauseCircle} />
                        <div className="bg-white rounded-2xl border border-border p-5">
                          {inactiveAds.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No inactive ads.</p>
                          ) : (
                            <div className="space-y-4">
                              {inactiveAds.map(ad => <InactiveAdCard key={ad.id} ad={ad} user={user} onRefresh={loadAds} />)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </TabsContent>

            <TabsContent value="library">
              <AdminSectionHeader title="Ad Library" icon={Images} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <AdLibraryManager user={user} />
              </div>
            </TabsContent>

            <TabsContent value="waitlist">
              <AdminSectionHeader title="Waitlist" icon={Clock} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <WaitlistManager user={user} onCheckoutForZip={handleCheckoutForWaitlistEntry} />
              </div>
            </TabsContent>

            <TabsContent value="rules">
              <AdminSectionHeader title="Rules & Terms" icon={Shield} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <RulesAndTerms />
              </div>
            </TabsContent>

            <TabsContent value="rates">
              <AdminSectionHeader title="Current Ad Rates" icon={DollarSign} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <CurrentRates />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}