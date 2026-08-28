import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, CheckCircle, Images, List, Shield, ChevronDown, ChevronUp,
  MapPin, AlertTriangle, Timer, Plus, Eye, MousePointerClick, BarChart3,
  RefreshCw, Clock, DollarSign, Tag,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import AdminSectionHeader from "@/components/admin/AdminSectionHeader";
import AdminPanelShell from "@/components/admin/AdminPanelShell";
import Paginator, { PAGE_SIZE } from "@/components/admin/Paginator";
import AdLibraryManager from "@/components/ads/AdLibraryManager";
import SupporterAdHomePreview from "@/components/ads/SupporterAdHomePreview";
import ActiveAdCard from "@/components/ads/ActiveAdCard";
import InactiveAdCard from "@/components/ads/InactiveAdCard";
import WaitlistManager, { joinAdWaitlist } from "@/components/ads/WaitlistManager";
import CurrentAdRates from "@/components/ads/CurrentAdRates";
import { createAdCheckout, validateAdDiscount } from "@/lib/adBilling";
import { SUPPORTER_RULES, TOS_INTRO, TOS_SECTIONS, TOS_FOOTER } from "@/lib/supporterContent";
import { countOpenAdSlots, SLOT_HOLDING_STATUSES } from "@/lib/waitlistQueue";
import useBetaConfig, { isZipAllowed, betaZipBlockedCopy } from "@/lib/useBetaConfig"; // BETA MODE
import SearchClearField from "@/components/shared/SearchClearField";

const ADS_STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const chipClass = (active) =>
  `text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
    active
      ? "border-mint-300 bg-mint-50 text-mint-700"
      : "border-border bg-white hover:bg-mint-50 hover:border-mint-200 hover:text-mint-700 text-muted-foreground"
  }`;

function formatAdAmount(amount, planType) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  return planType === "annual" ? `$${formatted}/yr` : `$${formatted}/mo`;
}

function formatDollars(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  const formatted = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  return `$${formatted}`;
}

const RESERVATION_MINUTES = 10;

function RulesAndTerms() {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);
  return (
    <div className="space-y-3">
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
          onClick={() => setRulesOpen((o) => !o)}
        >
          <span>Our Supporter Rules</span>
          {rulesOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {rulesOpen && (
          <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/20">
            {SUPPORTER_RULES.map((rule) => (
              <div key={rule.title} className="flex gap-2">
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
      <div className="border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/30 transition-colors text-left"
          onClick={() => setTosOpen((o) => !o)}
        >
          <span>Supporter Terms of Service</span>
          {tosOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {tosOpen && (
          <div className="border-t border-border px-4 py-4 bg-muted/20 space-y-4 text-xs text-muted-foreground">
            <p className="leading-relaxed">{TOS_INTRO}</p>
            {TOS_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="font-heading font-bold text-sm mb-1 text-foreground">{section.title}</h3>
                {section.paragraphs.map((p, i) => (
                  <p key={i} className={`leading-relaxed ${i > 0 ? "mt-2" : ""}`}>{p}</p>
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
            <Link to="/advertiser-terms" className="text-mint-600 hover:underline text-sm">Open full terms page →</Link>
          </div>
        )}
      </div>
    </div>
  );
}

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

function CountdownBanner({ expiresAt, onExpired }) {
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    let fired = false;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0 && !fired) {
        fired = true;
        onExpired();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 120;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm font-medium ${isUrgent ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
      <Timer className={`w-4 h-4 shrink-0 ${isUrgent ? "text-red-500" : "text-amber-500"}`} />
      <div className="flex-1">
        <span className="font-semibold">Spot reserved — </span>
        <span>{isUrgent ? "Hurry! " : ""}Complete your request within </span>
        <span className={`font-mono font-bold text-base ${isUrgent ? "text-red-600" : "text-amber-600"}`}>
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}

function NewAdForm({ user, onSuccess, onCancel, onGoToLibrary, prefill, onJoinedWaitlist }) {
  const { toast } = useToast();
  const betaConfig = useBetaConfig(); // BETA MODE
  const [pricing, setPricing] = useState({ monthly_rate: 150, annual_discount_percent: 30 });
  const [step, setStep] = useState(1);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [form, setForm] = useState({
    zip_code: prefill?.zip_code || user?.zip_code || "",
    plan_type: prefill?.plan_type || "monthly",
    discount_code: "",
  });
  const [zipChecking, setZipChecking] = useState(false);
  const [zipStatus, setZipStatus] = useState(null);
  const [reservationExpiry, setReservationExpiry] = useState(null);
  const [expired, setExpired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [approvedAssets, setApprovedAssets] = useState(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [agreements, setAgreements] = useState({
    terms: false,
    exactZip: false,
    noRefunds: false,
  });
  const [discountPreview, setDiscountPreview] = useState(null);
  const [discountApplying, setDiscountApplying] = useState(false);
  const allAgreementsChecked = agreements.terms && agreements.exactZip && agreements.noRefunds;

  useEffect(() => {
    supabase.from("ad_pricing_config").select("*").eq("config_key", "global").maybeSingle()
      .then(({ data }) => { if (data) setPricing(data); })
      .catch(() => {});
  }, []);

  // Prefill from waitlist claim: skip to creative step after a quick availability check
  useEffect(() => {
    if (!prefill?.zip_code) return;
    (async () => {
      setForm({
        zip_code: prefill.zip_code,
        plan_type: prefill.plan_type || "monthly",
        discount_code: "",
      });
      setZipChecking(true);
      try {
        const zip = prefill.zip_code.trim();
        const { data: existing } = await supabase
          .from("banner_ads")
          .select("id, status, user_id")
          .eq("zip_code", zip);
        const holding = (existing || []).filter((ad) => SLOT_HOLDING_STATUSES.includes(ad.status));
        const userAlreadyHasAd = holding.some((ad) => ad.user_id === user.id);
        const slotInfo = await countOpenAdSlots(supabase, zip, {
          ignoreWaitlistEntryId: prefill.waitlist_entry_id || null,
        });
        // Waitlist claimants redeem their reserved offer — treat as available when open > 0.
        const available = slotInfo.open > 0 && !userAlreadyHasAd;
        setZipStatus({
          available,
          slots_total: slotInfo.maxSlots,
          slots_used: slotInfo.holding + slotInfo.reservedOffers,
          userAlreadyHasAd,
          fromWaitlistOffer: Boolean(prefill.waitlist_entry_id),
        });
        if (available) {
          setReservationExpiry(Date.now() + RESERVATION_MINUTES * 60 * 1000);
          setExpired(false);
          const { data } = await supabase
            .from("ad_library")
            .select("*")
            .eq("user_id", user.id)
            .eq("moderation_status", "approved")
            .order("created_at", { ascending: false });
          setApprovedAssets(data || []);
          setStep(2);
        } else if (prefill.waitlist_entry_id && !userAlreadyHasAd) {
          toast({
            title: "Could not claim waitlist spot",
            description: `Zip ${zip} still looks full (${slotInfo.holding} ads + ${slotInfo.reservedOffers} other offers / ${slotInfo.maxSlots} max). Try again or contact support.`,
            variant: "destructive",
          });
        }
      } catch {
        setZipStatus({ error: true });
      }
      setZipChecking(false);
    })();
  }, [prefill?.zip_code, prefill?.plan_type, prefill?.waitlist_entry_id, user?.id]);

  const annualPrice = Math.round(Number(pricing.monthly_rate) * 12 * (1 - Number(pricing.annual_discount_percent) / 100));
  const baseAmount = form.plan_type === "annual" ? annualPrice : Number(pricing.monthly_rate);
  const discountApplied =
    discountPreview?.valid &&
    discountPreview.code &&
    discountPreview.plan_type === form.plan_type &&
    (form.discount_code || "").trim().toUpperCase() === discountPreview.code;
  const amountDue = discountApplied ? discountPreview.discounted_amount : baseAmount;

  useEffect(() => {
    setDiscountPreview(null);
  }, [form.plan_type]);

  const handleApplyDiscount = async () => {
    const code = form.discount_code.trim();
    if (!code) {
      setDiscountPreview(null);
      return;
    }
    setDiscountApplying(true);
    try {
      const result = await validateAdDiscount({
        discount_code: code,
        plan_type: form.plan_type,
      });
      setDiscountPreview(result);
      if (!result.valid) {
        toast({
          title: "Discount code not valid",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      setDiscountPreview(null);
      toast({ title: "Could not validate code", description: err.message, variant: "destructive" });
    }
    setDiscountApplying(false);
  };

  const ensureDiscountReady = async () => {
    const code = form.discount_code.trim();
    if (!code) return true;

    if (
      discountPreview?.valid &&
      discountPreview.code === code.toUpperCase() &&
      discountPreview.plan_type === form.plan_type
    ) {
      return true;
    }

    const result = await validateAdDiscount({
      discount_code: code,
      plan_type: form.plan_type,
    });
    setDiscountPreview(result);
    if (!result.valid) {
      toast({
        title: "Discount code not valid",
        description: result.error || "Apply a valid code before continuing to payment.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const checkZipAvailability = async () => {
    const zip = form.zip_code.trim();
    if (zip.length !== 5) return;
    setZipChecking(true);
    setZipStatus(null);
    try {
      // BETA MODE — Stage 2 whitelist
      if (!isZipAllowed(zip, betaConfig)) {
        const copy = betaZipBlockedCopy(zip);
        setZipStatus({ available: false, betaBlocked: true, errorMessage: `${copy.title}. ${copy.description}` });
        toast({ title: copy.title, description: copy.description, variant: "destructive" });
        setZipChecking(false);
        return;
      }

      const { data: existingAds, error } = await supabase
        .from("banner_ads")
        .select("id, status, user_id")
        .eq("zip_code", zip);
      if (error) throw error;
      const holding = (existingAds || []).filter((ad) => SLOT_HOLDING_STATUSES.includes(ad.status));
      const userAlreadyHasAd = holding.some((ad) => ad.user_id === user.id);
      const slotInfo = await countOpenAdSlots(supabase, zip);
      setZipStatus({
        available: slotInfo.open > 0 && !userAlreadyHasAd,
        slots_total: slotInfo.maxSlots,
        slots_used: slotInfo.holding + slotInfo.reservedOffers,
        userAlreadyHasAd,
      });
    } catch {
      setZipStatus({ available: false, error: true });
    }
    setZipChecking(false);
  };

  const handleZipConfirmed = async () => {
    setReservationExpiry(Date.now() + RESERVATION_MINUTES * 60 * 1000);
    setExpired(false);

    const { data, error } = await supabase
      .from("ad_library")
      .select("*")
      .eq("user_id", user.id)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Could not load creatives", description: error.message, variant: "destructive" });
      setApprovedAssets([]);
    } else {
      setApprovedAssets(data || []);
    }
    setStep(2);
  };

  const handleExpired = useCallback(() => {
    setExpired(true);
    toast({
      title: "Reservation expired",
      description: "Your spot hold timed out. Please start over to check availability again.",
      variant: "destructive",
    });
  }, [toast]);

  const handleSubmitRequest = async () => {
    if (!selectedAsset) return;
    if (!allAgreementsChecked) {
      toast({
        title: "Please confirm all agreements",
        description: "Check all three boxes on the Review step before continuing to payment.",
        variant: "destructive",
      });
      return;
    }
    const zip = form.zip_code.trim();
    // BETA MODE — Stage 2 whitelist (also enforced server-side)
    if (!isZipAllowed(zip, betaConfig)) {
      const copy = betaZipBlockedCopy(zip);
      toast({ title: copy.title, description: copy.description, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const discountOk = await ensureDiscountReady();
      if (!discountOk) {
        setSubmitting(false);
        return;
      }

      const result = await createAdCheckout({
        plan_type: form.plan_type,
        zip_code: zip,
        business_name: selectedAsset.ad_name,
        link_url: selectedAsset.link_url,
        image_url: selectedAsset.image_url,
        ad_library_id: selectedAsset.id,
        discount_code: form.discount_code?.trim() || undefined,
        waitlist_entry_id: prefill?.waitlist_entry_id || undefined,
        success_url: `${window.location.origin}/ad-manager?success=true`,
        cancel_url: `${window.location.origin}/ad-manager?cancelled=true`,
        agree_terms: true,
        agree_exact_zip: true,
        agree_no_refunds: true,
      });

      if (result.admin_bypass) {
        toast({
          title: "Ad is live!",
          description: `Admin bypass — your ad for zip ${zip} is now active with no payment required.`,
        });
        onSuccess();
        return;
      }

      // Redirect to Stripe Checkout to complete payment.
      window.location.href = result.url;
    } catch (err) {
      toast({ title: "Request failed", description: err.message, variant: "destructive" });
      setSubmitting(false);
    }
  };

  const handleJoinWaitlist = async () => {
    setJoiningWaitlist(true);
    try {
      await joinAdWaitlist({
        user,
        zipCode: form.zip_code,
        planType: form.plan_type,
      });
      toast({
        title: "Joined waitlist",
        description: `You're in line for zip ${form.zip_code}.`,
      });
      onJoinedWaitlist?.();
    } catch (err) {
      toast({ title: "Could not join waitlist", description: err.message, variant: "destructive" });
    }
    setJoiningWaitlist(false);
  };

  const STEP_LABELS = ["Zip Code", "Creative", "Plan", "Review"];

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
          <p className="text-sm text-muted-foreground">
            Your {RESERVATION_MINUTES}-minute spot hold for zip <strong>{form.zip_code}</strong> has timed out. The spot may now be available to others.
          </p>
          <Button
            className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
            onClick={() => {
              setStep(1);
              setExpired(false);
              setZipStatus(null);
              setReservationExpiry(null);
              setSelectedAsset(null);
            }}
          >
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

      {reservationExpiry && step > 1 && (
        <CountdownBanner expiresAt={reservationExpiry} onExpired={handleExpired} />
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">See if the zip code is available for advertising *</label>
            <div className="flex gap-2 mt-1">
              <input
                className="w-32 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="89448"
                maxLength={5}
                value={form.zip_code}
                onChange={(e) => {
                  setForm((f) => ({ ...f, zip_code: e.target.value.replace(/\D/g, "").slice(0, 5) }));
                  setZipStatus(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && form.zip_code.length === 5) checkZipAvailability();
                }}
              />
              <Button
                className="rounded-xl shrink-0 bg-mint-500 hover:bg-mint-600 text-white"
                disabled={form.zip_code.length !== 5 || zipChecking}
                onClick={checkZipAvailability}
              >
                {zipChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your ad will show to families whose zip code — either their profile zip or a zip they've manually entered — exactly matches the zip code that your ad is placed for (there is no surrounding mile radius; only this exact zip code is targeted). You may want to consider advertising in multiple zip codes if the Activity-area that you want to show support for includes users from a variety of surrounding zip codes.
            </p>
          </div>

          {zipStatus && (
            <div className={`rounded-2xl p-4 text-sm ${zipStatus.available ? "bg-mint-50 border border-mint-200" : "bg-red-50 border border-red-200"}`}>
              {zipStatus.error ? (
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Could not check availability. Please try again.</span>
                </div>
              ) : zipStatus.betaBlocked ? (
                <div className="flex items-start gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Not available during beta</p>
                    <p className="text-xs mt-1">{zipStatus.errorMessage || "This zip isn’t in our beta area yet."}</p>
                  </div>
                </div>
              ) : zipStatus.available ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-mint-600">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>
                      <span className="font-semibold">Spot available!</span> {zipStatus.slots_used} of {zipStatus.slots_total} spots filled in {form.zip_code}.
                    </span>
                  </div>
                  <p className="text-xs text-mint-700 pl-6">
                    Confirming this zip will hold your spot for {RESERVATION_MINUTES} minutes while you finish your request.
                  </p>
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
                  <div className="flex-1">
                    <p className="font-semibold">No slots available in {form.zip_code}</p>
                    <p className="text-xs mt-1">All {zipStatus.slots_total} spots are filled. Join the waitlist to be notified when a spot opens.</p>
                    <Button
                      size="sm"
                      className="mt-3 rounded-xl h-7 text-xs bg-peach-500 hover:bg-peach-400 text-white"
                      disabled={joiningWaitlist}
                      onClick={handleJoinWaitlist}
                    >
                      {joiningWaitlist ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                      Join Waitlist for {form.zip_code}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
            disabled={!zipStatus?.available}
            onClick={handleZipConfirmed}
          >
            <MapPin className="w-4 h-4 mr-1" /> Confirm {form.zip_code} & Start {RESERVATION_MINUTES}-Min Hold →
          </Button>

          <div className="bg-muted/30 rounded-2xl p-4 text-xs text-muted-foreground space-y-1.5 border border-border">
            <p className="font-semibold text-foreground text-sm mb-2">Before you start — have these ready:</p>
            <p>
              ✦ An <strong>approved ad creative</strong> from your{" "}
              <button type="button" onClick={onGoToLibrary} className="text-mint-500 underline font-semibold">Ad Library</button>
              {" "}(image + destination URL pre-approved)
            </p>
            <p>✦ You'll complete secure payment via Stripe Checkout — your ad goes live as soon as payment succeeds</p>
            <p>✦ Once you confirm a zip code, you'll have <strong>{RESERVATION_MINUTES} minutes</strong> to complete your request</p>
            <p>
              ✦ Please review our <a href="/supporters" target="_blank" rel="noreferrer" className="text-mint-500 underline">Supporter Community Rules</a>
              {" "}and <a href="/advertiser-terms" target="_blank" rel="noreferrer" className="text-mint-500 underline">Terms & Conditions</a> before proceeding
            </p>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {approvedAssets !== null && approvedAssets.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800">No approved creatives yet</p>
                <p className="text-xs text-amber-700 mt-1">
                  Upload a creative in the <strong>Ad Library</strong> tab and wait for admin approval (status must be Approved).
                  Pending creatives cannot be selected for placement. <strong>Your timer is running.</strong>
                </p>
                <Button size="sm" variant="outline" className="rounded-xl mt-2 h-7 text-xs" onClick={onGoToLibrary}>
                  Go to Ad Library
                </Button>
              </div>
            </div>
          )}

          {selectedAsset && (
            <div className="space-y-3 rounded-2xl border border-mint-200 bg-mint-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{selectedAsset.ad_name}</p>
                  <p className="text-xs text-mint-600">Selected creative</p>
                </div>
                <Button variant="ghost" size="sm" className="text-xs rounded-xl shrink-0" onClick={() => setSelectedAsset(null)}>
                  Change
                </Button>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Homepage preview — zip {form.zip_code || "—"}
                </p>
                <div className="max-w-sm">
                  <SupporterAdHomePreview
                    imageUrl={selectedAsset.image_url}
                    zipCode={form.zip_code}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  Your image is cropped to this frame on the homepage activity feed (same border and size as live Supporter ads).
                </p>
              </div>
            </div>
          )}

          <AdLibraryManager
            key={`select-${libraryRefreshKey}`}
            user={user}
            onSelectAsset={(asset) => setSelectedAsset(asset)}
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Only <strong>Approved</strong> creatives show a Use button. If admin just approved one, click Refresh.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl h-7 text-xs shrink-0"
              onClick={async () => {
                const { data, error } = await supabase
                  .from("ad_library")
                  .select("*")
                  .eq("user_id", user.id)
                  .eq("moderation_status", "approved")
                  .order("created_at", { ascending: false });
                if (error) toast({ title: "Refresh failed", description: error.message, variant: "destructive" });
                else {
                  setApprovedAssets(data || []);
                  setLibraryRefreshKey((k) => k + 1);
                }
              }}
            >
              Refresh
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl flex-1"
              onClick={() => {
                setStep(1);
                setReservationExpiry(null);
                setZipStatus(null);
              }}
            >
              ← Back
            </Button>
            <Button
              className="flex-1 rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
              disabled={!selectedAsset}
              onClick={() => setStep(3)}
            >
              Next: Choose Plan →
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground bg-mint-50 border border-mint-100 rounded-xl px-3 py-2">
            You'll be redirected to secure Stripe Checkout on the next step to complete payment.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "monthly", label: "Monthly", price: `$${pricing.monthly_rate}/mo`, desc: "Flexible, cancel anytime." },
              {
                id: "annual",
                label: "Annual",
                price: `$${annualPrice.toLocaleString()}/yr`,
                desc: `Save ${pricing.annual_discount_percent}% — best value.`,
                highlight: true,
              },
            ].map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, plan_type: plan.id }))}
                className={`text-left p-4 rounded-2xl border-2 transition-all ${form.plan_type === plan.id ? "border-mint-500 bg-mint-50" : "border-border bg-white hover:border-mint-200"}`}
              >
                {plan.highlight && <div className="text-xs font-bold text-peach-500 mb-1">⭐ Best Value</div>}
                <div className="font-heading font-bold text-lg">{plan.price}</div>
                <div className="text-xs text-muted-foreground mt-1">{plan.desc}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl flex-1" onClick={() => setStep(2)}>← Back</Button>
            <Button className="flex-1 rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => setStep(4)}>
              Next: Review →
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          {selectedAsset?.image_url && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Homepage preview — zip {form.zip_code}
              </p>
              <div className="max-w-sm">
                <SupporterAdHomePreview
                  imageUrl={selectedAsset.image_url}
                  zipCode={form.zip_code}
                />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Black border and crop match how families see your ad on the homepage.
              </p>
            </div>
          )}

          <div className="bg-muted/50 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Creative</span><span className="font-medium">{selectedAsset?.ad_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Destination</span><span className="font-medium truncate max-w-[200px]">{selectedAsset?.link_url}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Zip Code</span><span className="font-medium">{form.zip_code}</span></div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium capitalize">
                {form.plan_type} — {formatAdAmount(baseAmount, form.plan_type)}
              </span>
            </div>
            {discountApplied ? (
              <div className="flex justify-between text-mint-700">
                <span>Discount ({discountPreview.discount_percent}% off)</span>
                <span className="font-medium">
                  You save {formatDollars(discountPreview.original_amount - discountPreview.discounted_amount)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between pt-2 border-t border-border">
              <span className="text-muted-foreground font-medium">Amount due today</span>
              <span className="font-semibold text-foreground">
                {discountApplied ? (
                  <>
                    <span className="text-muted-foreground line-through font-normal mr-2">
                      {formatAdAmount(baseAmount, form.plan_type)}
                    </span>
                    {formatAdAmount(amountDue, form.plan_type)}
                  </>
                ) : (
                  formatAdAmount(amountDue, form.plan_type)
                )}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium flex items-center gap-1 mb-1">
              <Tag className="w-3 h-3" /> Discount code (optional)
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. LAUNCH20"
                value={form.discount_code}
                onChange={(e) => {
                  setForm((f) => ({ ...f, discount_code: e.target.value.toUpperCase() }));
                  setDiscountPreview(null);
                }}
                className="rounded-xl flex-1"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-xl shrink-0"
                disabled={discountApplying || !form.discount_code.trim()}
                onClick={handleApplyDiscount}
              >
                {discountApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
            {discountApplied ? (
              <p className="text-xs text-mint-700 mt-1.5">
                <CheckCircle className="w-3 h-3 inline mr-1" />
                Code <strong>{discountPreview.code}</strong> applied — {discountPreview.renewals_label}.
              </p>
            ) : discountPreview && !discountPreview.valid ? (
              <p className="text-xs text-destructive mt-1.5">{discountPreview.error}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1.5">
                Apply your code here to see the discounted rate before Stripe Checkout.
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Before payment, confirm each item:</p>
            <label htmlFor="agree-terms" className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                id="agree-terms"
                checked={agreements.terms}
                onCheckedChange={(checked) => setAgreements((a) => ({ ...a, terms: Boolean(checked) }))}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I agree to the{" "}
                <a href="/advertiser-terms" target="_blank" rel="noreferrer" className="text-mint-500 underline">
                  Supporter Terms &amp; Conditions
                </a>
                .
              </span>
            </label>
            <label htmlFor="agree-exact-zip" className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                id="agree-exact-zip"
                checked={agreements.exactZip}
                onCheckedChange={(checked) => setAgreements((a) => ({ ...a, exactZip: Boolean(checked) }))}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I understand that my ad will show to users whose zip code — either their profile zip or a zip they&apos;ve manually entered — exactly matches the zip code that my ad is placed for (there is no surrounding mile radius involved; only this exact zip code is targeted).
              </span>
            </label>
            <label htmlFor="agree-no-refunds" className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                id="agree-no-refunds"
                checked={agreements.noRefunds}
                onCheckedChange={(checked) => setAgreements((a) => ({ ...a, noRefunds: Boolean(checked) }))}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground leading-relaxed">
                I understand there are no refunds after I&apos;m redirected to complete payment before my ad goes live.
              </span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl flex-1" onClick={() => setStep(3)}>← Back</Button>
            <Button
              className="flex-1 rounded-xl bg-peach-400 hover:bg-peach-500 text-white font-semibold"
              disabled={submitting || !allAgreementsChecked}
              onClick={handleSubmitRequest}
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Redirecting to Stripe…</>
                : "Pay & Publish →"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdManager() {
  const { user, userLoading } = useOutletContext();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [waitlistPrefill, setWaitlistPrefill] = useState(null);
  const [adsSearch, setAdsSearch] = useState("");
  const [adsStatusFilter, setAdsStatusFilter] = useState("all");
  const [adsPage, setAdsPage] = useState(1);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get("tab");
    return ["ads", "library", "waitlist", "rules", "rates"].includes(tab) ? tab : "ads";
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (["ads", "library", "waitlist", "rules", "rates"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!userLoading && user) loadAds();
  }, [user, userLoading]);

  // Land back here after Stripe Checkout redirect (?success=true or ?cancelled=true).
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Payment successful!",
        description: "Your ad has been activated (or sent for review if it needed one).",
      });
      const next = new URLSearchParams(searchParams);
      next.delete("success");
      next.delete("ad_id");
      setSearchParams(next, { replace: true });
    } else if (searchParams.get("cancelled") === "true") {
      const pendingAdId = searchParams.get("ad_id");
      toast({
        title: "Checkout cancelled",
        description: pendingAdId
          ? "Payment wasn't completed. Use Complete Payment on that ad below, or cancel the request to release the zip slot."
          : "Payment wasn't completed. If your ad shows Pending Payment, use Complete Payment below or cancel the request.",
      });
      const next = new URLSearchParams(searchParams);
      next.delete("cancelled");
      next.delete("ad_id");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAds = async ({ silent } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase
        .from("banner_ads")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setAds(data || []);
      if (silent) toast({ title: "Ads refreshed" });
    } catch {
      setAds([]);
      if (silent) toast({ title: "Refresh failed", variant: "destructive" });
    }
    if (silent) setRefreshing(false);
    else setLoading(false);
  };

  const handleClaimWaitlistSpot = (entry) => {
    setWaitlistPrefill({
      zip_code: entry.zip_code,
      plan_type: entry.plan_type,
      waitlist_entry_id: entry.id,
    });
    setShowNewForm(true);
    toast({
      title: `Claiming spot for zip ${entry.zip_code}`,
      description: "Select your ad creative to proceed.",
    });
  };

  const activeAds = useMemo(() => ads.filter((a) => a.status === "active"), [ads]);
  const inactiveAds = useMemo(() => ads.filter((a) => a.status !== "active"), [ads]);
  const impressions = ads.reduce((sum, a) => sum + Number(a.impressions || 0), 0);
  const clicks = ads.reduce((sum, a) => sum + Number(a.clicks || 0), 0);
  const ctr = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "0.0";

  const filteredAds = useMemo(() => {
    let list = [...ads];
    if (adsStatusFilter === "active") list = list.filter((a) => a.status === "active");
    if (adsStatusFilter === "inactive") list = list.filter((a) => a.status !== "active");
    const q = adsSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const hay = [
          a.zip_code,
          a.business_name,
          a.status,
          a.plan_type,
          a.link_url,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [ads, adsSearch, adsStatusFilter]);

  useEffect(() => {
    setAdsPage(1);
  }, [adsSearch, adsStatusFilter]);

  const paginatedAds = filteredAds.slice((adsPage - 1) * PAGE_SIZE, adsPage * PAGE_SIZE);

  if (userLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center px-4">
        <h1 className="font-heading font-bold text-2xl mb-3">Ad Manager</h1>
        <p className="text-muted-foreground mb-6">Please log in to manage Supporter ads.</p>
        <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={() => { window.location.href = "/login"; }}>
          Log In
        </Button>
      </div>
    );
  }

  if (!user.is_advertiser) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center px-4">
        <h1 className="font-heading font-bold text-2xl mb-3">Ad Manager</h1>
        <p className="text-muted-foreground mb-6">
          Ad Manager is for Supporters. Become a Supporter from the Supporters page to unlock it in your account menu.
        </p>
        <Button className="rounded-xl bg-peach-500 hover:bg-peach-400 text-white" asChild>
          <Link to="/supporters">Go to Supporters</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="font-heading font-bold text-2xl">Ad Manager</h1>
          <p className="text-sm text-muted-foreground">
            Manage your Supporter advertising campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={refreshing || showNewForm}
            onClick={() => loadAds({ silent: true })}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {!showNewForm && (
            <Button
              size="sm"
              className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
              onClick={() => setShowNewForm(true)}
            >
              <Plus className="w-4 h-4 mr-1" /> New Ad
            </Button>
          )}
        </div>
      </div>

      {showNewForm ? (
        <NewAdForm
          user={user}
          prefill={waitlistPrefill}
          onCancel={() => {
            setShowNewForm(false);
            setWaitlistPrefill(null);
          }}
          onSuccess={() => {
            setShowNewForm(false);
            setWaitlistPrefill(null);
            setActiveTab("ads");
            loadAds();
          }}
          onGoToLibrary={() => {
            setShowNewForm(false);
            setWaitlistPrefill(null);
            setActiveTab("library");
          }}
          onJoinedWaitlist={() => {
            setShowNewForm(false);
            setWaitlistPrefill(null);
            setActiveTab("waitlist");
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard icon={Eye} label="Total Impressions" value={impressions.toLocaleString()} />
            <StatCard icon={MousePointerClick} label="Total Clicks" value={clicks.toLocaleString()} />
            <StatCard icon={BarChart3} label="Click-Through Rate" value={`${ctr}%`} />
            <StatCard icon={CheckCircle} label="Active Ads" value={activeAds.length} />
          </div>

          <Tabs value={activeTab} onValueChange={(tab) => {
            setActiveTab(tab);
            const next = new URLSearchParams(searchParams);
            if (tab === "ads") next.delete("tab");
            else next.set("tab", tab);
            setSearchParams(next, { replace: true });
          }}>
            <TabsList className="rounded-xl mb-4 flex-wrap h-auto">
              <TabsTrigger value="ads" className="rounded-lg flex items-center gap-1.5">
                <List className="w-3.5 h-3.5" />My Active Ads ({activeAds.length})
              </TabsTrigger>
              <TabsTrigger value="library" className="rounded-lg flex items-center gap-1.5">
                <Images className="w-3.5 h-3.5" />Ad Library
              </TabsTrigger>
              <TabsTrigger value="waitlist" className="rounded-lg flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />Waitlist
              </TabsTrigger>
              <TabsTrigger value="rules" className="rounded-lg flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />Rules & Terms
              </TabsTrigger>
              <TabsTrigger value="rates" className="rounded-lg flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" />Current Ad Rates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ads" className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
                </div>
              ) : ads.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-border">
                  <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="font-heading font-semibold mb-1">No ads yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Add an approved creative in Ad Library, then submit a new ad for a zip code.
                  </p>
                  <Button
                    className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
                    onClick={() => setShowNewForm(true)}
                  >
                    Submit Your First Ad
                  </Button>
                </div>
              ) : (
                <>
                  <AdminSectionHeader title="My Active Ads" icon={CheckCircle} />
                  <AdminPanelShell>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <SearchClearField
                          placeholder="Search by zip, name, status…"
                          value={adsSearch}
                          onValueChange={setAdsSearch}
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {ADS_STATUS_FILTERS.map((f) => (
                            <button
                              key={f.value}
                              type="button"
                              onClick={() => setAdsStatusFilter(f.value)}
                              className={chipClass(adsStatusFilter === f.value)}
                            >
                              {f.label}
                              {f.value === "all"
                                ? ` (${ads.length})`
                                : f.value === "active"
                                  ? ` (${activeAds.length})`
                                  : ` (${inactiveAds.length})`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {filteredAds.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-10">
                          {adsSearch.trim()
                            ? "No ads match your search."
                            : adsStatusFilter === "active"
                              ? "No active ads."
                              : adsStatusFilter === "inactive"
                                ? "No inactive ads."
                                : "No ads yet."}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {paginatedAds.map((ad) =>
                            ad.status === "active" ? (
                              <ActiveAdCard
                                key={ad.id}
                                ad={ad}
                                user={user}
                                onRefresh={() => loadAds({ silent: true })}
                              />
                            ) : (
                              <InactiveAdCard
                                key={ad.id}
                                ad={ad}
                                user={user}
                                onRefresh={() => loadAds({ silent: true })}
                              />
                            )
                          )}
                          <Paginator total={filteredAds.length} page={adsPage} onPage={setAdsPage} />
                        </div>
                      )}
                    </div>
                  </AdminPanelShell>
                </>
              )}
            </TabsContent>

            <TabsContent value="library">
              <div className="bg-white rounded-2xl border border-border p-5">
                <AdLibraryManager user={user} />
              </div>
            </TabsContent>

            <TabsContent value="waitlist">
              <AdminSectionHeader title="Waitlist" icon={Clock} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <WaitlistManager user={user} onClaimSpot={handleClaimWaitlistSpot} />
              </div>
            </TabsContent>

            <TabsContent value="rules">
              <div className="bg-white rounded-2xl border border-border p-5">
                <AdminSectionHeader title="Rules & Terms" icon={Shield} />
                <div className="mt-3">
                  <RulesAndTerms />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="rates">
              <AdminSectionHeader title="Current Ad Rates" icon={DollarSign} />
              <div className="bg-white rounded-2xl border border-border p-5">
                <CurrentAdRates />
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
