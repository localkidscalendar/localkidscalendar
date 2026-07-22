import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { BellOff, ExternalLink, Loader2, ImageIcon, MapPin, Clock, XCircle, AlertCircle, PartyPopper, ArrowUpDown, ArrowUp, ArrowDown, BarChart3, Eye, MousePointerClick, CheckCircle, RefreshCw, List, Images } from "lucide-react";
import moment from "moment";

const STATUS_CONFIG = {
  active:          { label: "Active",             color: "bg-mint-100 text-mint-600" },
  past_due:        { label: "Payment Past Due",    color: "bg-orange-100 text-orange-600" },
  expired:         { label: "Paused/Deactivated",  color: "bg-gray-100 text-gray-500" },
  flagged:         { label: "Flagged",             color: "bg-peach-100 text-peach-600" },
  rejected:        { label: "Rejected",            color: "bg-red-100 text-red-600" },
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

const MOCK_ADS = [
  {
    id: "1",
    business_name: "Sunshine Swim Academy",
    zip_code: "89448",
    plan_type: "monthly",
    status: "active",
    auto_renew: true,
    stripe_subscription_id: "sub_mock1",
    next_renewal_date: moment().add(20, "days").format("YYYY-MM-DD"),
    plan_start_date: moment().subtract(10, "days").format("YYYY-MM-DD"),
    plan_end_date: moment().add(20, "days").format("YYYY-MM-DD"),
    impressions: 1240,
    clicks: 38,
    image_url: "https://images.unsplash.com/photo-1560089000-7433a4ebbd64?w=400&h=200&fit=crop",
    _scenario: "Active — Normal (renewal > 14 days away)",
  },
  {
    id: "2",
    business_name: "Little Kickers Soccer",
    zip_code: "89449",
    plan_type: "monthly",
    status: "active",
    auto_renew: true,
    stripe_subscription_id: "sub_mock2",
    next_renewal_date: moment().add(6, "days").format("YYYY-MM-DD"),
    plan_start_date: moment().subtract(24, "days").format("YYYY-MM-DD"),
    plan_end_date: moment().add(6, "days").format("YYYY-MM-DD"),
    impressions: 980,
    clicks: 21,
    image_url: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=200&fit=crop",
    _scenario: "Active — Within 14-day cancellation window (renewal in 6 days)",
  },
  {
    id: "3",
    business_name: "Mountain Art Studio",
    zip_code: "89448",
    plan_type: "annual",
    status: "active",
    auto_renew: false,
    stripe_subscription_id: "sub_mock3",
    next_renewal_date: moment().add(45, "days").format("YYYY-MM-DD"),
    plan_start_date: moment().subtract(320, "days").format("YYYY-MM-DD"),
    plan_end_date: moment().add(45, "days").format("YYYY-MM-DD"),
    impressions: 8420,
    clicks: 312,
    image_url: "https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=400&h=200&fit=crop",
    _scenario: "Active — Non-renew already set",
  },
  {
    id: "4",
    business_name: "Tahoe Tumbling Gym",
    zip_code: "96150",
    plan_type: "monthly",
    status: "past_due",
    auto_renew: true,
    stripe_subscription_id: "sub_mock4",
    next_renewal_date: moment().subtract(2, "days").format("YYYY-MM-DD"),
    plan_start_date: moment().subtract(32, "days").format("YYYY-MM-DD"),
    plan_end_date: moment().subtract(2, "days").format("YYYY-MM-DD"),
    grace_period_start: moment().subtract(2, "days").toISOString(),
    impressions: 540,
    clicks: 9,
    image_url: "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=400&h=200&fit=crop",
    _scenario: "Past Due — Payment failed, grace period active",
  },
  {
    id: "5",
    business_name: "Nature Explorers Camp",
    zip_code: "89451",
    plan_type: "monthly",
    status: "flagged",
    auto_renew: true,
    stripe_subscription_id: "sub_mock5",
    next_renewal_date: moment().add(15, "days").format("YYYY-MM-DD"),
    plan_start_date: moment().subtract(15, "days").format("YYYY-MM-DD"),
    plan_end_date: moment().add(15, "days").format("YYYY-MM-DD"),
    impressions: 220,
    clicks: 4,
    moderation_notes: "Ad image contains external logo that may be misleading.",
    image_url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=200&fit=crop",
    _scenario: "Flagged — Admin review",
  },
];

function MockAdCard({ ad }) {
  const [showNonRenewConfirm, setShowNonRenewConfirm] = useState(false);
  const [nonRenewSet, setNonRenewSet] = useState(ad.auto_renew === false);

  const cfg = STATUS_CONFIG[ad.status] || STATUS_CONFIG.active;
  const msg = STATUS_MESSAGES[ad.status];

  const renewalDate = ad.next_renewal_date ? moment(ad.next_renewal_date) : null;
  const daysUntilRenewal = renewalDate ? renewalDate.diff(moment(), "days") : null;
  const withinCancellationWindow = daysUntilRenewal !== null && daysUntilRenewal < 14;
  const nextTermEnd = renewalDate
    ? moment(renewalDate).add(1, ad.plan_type === "annual" ? "year" : "month").format("MMM D, YYYY")
    : null;

  const handleMockNonRenew = () => {
    setNonRenewSet(true);
    setShowNonRenewConfirm(false);
  };

  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      {/* Scenario label */}
      <div className="text-xs font-mono bg-muted/60 text-muted-foreground rounded-lg px-3 py-1.5 mb-4 border border-dashed border-border">
        🧪 Scenario: <strong>{ad._scenario}</strong>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {ad.image_url && (
          <img src={ad.image_url} alt={ad.business_name} className="w-full sm:w-32 h-20 object-cover rounded-xl border border-border shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-heading font-semibold">{ad.business_name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
            {nonRenewSet && ad.status === "active" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Non-renewing</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            <span>Zip: {ad.zip_code}</span>
            <span className="capitalize">{ad.plan_type} plan</span>
            {ad.plan_start_date && (
              <span>{moment(ad.plan_start_date).format("MMM D, YYYY")} → {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : "—"}</span>
            )}
            {renewalDate && ad.status === "active" && !nonRenewSet && (
              <span>Renews {renewalDate.format("MMM D, YYYY")}</span>
            )}
            {renewalDate && ad.status === "active" && nonRenewSet && (
              <span className="text-amber-600 font-medium">
                Ends {ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : renewalDate.format("MMM D, YYYY")} (no renewal)
              </span>
            )}
          </div>

          {/* 14-day window warning */}
          {ad.status === "active" && !nonRenewSet && withinCancellationWindow && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-3">
              <p className="font-semibold mb-0.5">⚠️ Renewal in {daysUntilRenewal} day{daysUntilRenewal !== 1 ? "s" : ""} — cancellation window has passed</p>
              <p>Your next renewal charge is committed. If you set Non-renew now, your ad will continue through the upcoming paid term and expire at the end of it (<strong>{nextTermEnd}</strong>).</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: "Impressions", value: (ad.impressions || 0).toLocaleString() },
              { label: "Clicks",      value: (ad.clicks || 0).toLocaleString() },
              { label: "CTR",         value: ad.impressions > 0 ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-xl p-2 text-center">
                <p className="font-heading font-bold text-sm">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Non-renew button */}
          {ad.status === "active" && !nonRenewSet && ad.stripe_subscription_id && (
            <div className="mb-3">
              {!showNonRenewConfirm ? (
                <Button variant="outline" size="sm" className="rounded-xl h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50" onClick={() => setShowNonRenewConfirm(true)}>
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
                    <Button size="sm" className="rounded-xl h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white" onClick={handleMockNonRenew}>
                      {withinCancellationWindow ? "Understood — Set Non-renew" : "Confirm Non-renew"}
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={() => setShowNonRenewConfirm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {nonRenewSet && ad.status === "active" && (
            <p className="text-xs text-amber-600 mb-3">
              ✓ Non-renew confirmed — ad deactivates on <strong>{ad.plan_end_date ? moment(ad.plan_end_date).format("MMM D, YYYY") : "term end"}</strong>
            </p>
          )}

          {/* Status messages */}
          {msg && (
            <div className={`p-3 rounded-xl border text-xs ${msg.bg} ${msg.textColor}`}>
              <p className="font-semibold mb-1">{msg.title}</p>
              <p className="mb-2">{msg.body}</p>
              {ad.moderation_notes && <p className="mb-2"><strong>Note:</strong> {ad.moderation_notes}</p>}
              {ad.status === "past_due" && (
                <a href="#" className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 transition-colors">
                  Update Payment Method <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {ad.status !== "past_due" && (
                <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white mt-1 text-xs h-7">
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

const WAITLIST_STATUS_CONFIG = {
  waiting:  { label: "Waitlisted",     color: "bg-yellow-100 text-yellow-700", icon: Clock },
  offered:  { label: "Available!",     color: "bg-mint-100 text-mint-600",     icon: AlertCircle },
  accepted: { label: "Claimed ✓",      color: "bg-mint-100 text-mint-600",     icon: PartyPopper },
  cancelled:{ label: "Cancelled",      color: "bg-gray-100 text-gray-500",     icon: XCircle },
};

const MOCK_WAITLIST = [
  {
    id: "w1", zip_code: "89448", status: "waiting", position: 2,
    business_name: "Sunshine Swim Academy", plan_type: "monthly",
    created_date: moment().subtract(5, "days").toISOString(),
    _scenario: "Waiting — position #2 in queue",
  },
  {
    id: "w2", zip_code: "96150", status: "offered", position: 1,
    business_name: "Sunshine Swim Academy", plan_type: "annual",
    offer_expires_date: moment().add(2, "days").toISOString(),
    offer_count: 1,
    created_date: moment().subtract(12, "days").toISOString(),
    _scenario: "Available — spot opened, Subscribe button shown",
  },
  {
    id: "w3", zip_code: "89451", status: "waiting", position: 1,
    business_name: "Sunshine Swim Academy", plan_type: "monthly",
    created_date: moment().subtract(1, "days").toISOString(),
    _scenario: "Waiting — first in queue",
  },
  {
    id: "w4", zip_code: "89449", status: "cancelled", position: 3,
    business_name: "Sunshine Swim Academy", plan_type: "monthly",
    created_date: moment().subtract(20, "days").toISOString(),
    _scenario: "Cancelled — shown in past entries",
  },
];

function MockWaitlistManager() {
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [cancelled, setCancelled] = useState([]);
  const [showConfirm, setShowConfirm] = useState(null); // entry id

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const sortList = (list) => {
    if (!sortField) return list;
    return [...list].sort((a, b) => {
      const aVal = (a[sortField] || "").toString().toLowerCase();
      const bVal = (b[sortField] || "").toString().toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  };

  const activeEntries = sortList(MOCK_WAITLIST.filter(e => !["cancelled"].includes(e.status) && !cancelled.includes(e.id)));
  const pastEntries = MOCK_WAITLIST.filter(e => e.status === "cancelled" || cancelled.includes(e.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-heading font-semibold">Waitlisted Zip Codes</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Join the queue for full zip codes — we'll email you when a spot opens.</p>
        </div>

      </div>

      {activeEntries.length > 0 && (
        <div className="space-y-2">
          {/* Sort header */}
          <div className="flex items-center gap-2 px-1 pb-1">
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium" onClick={() => handleSort("zip_code")}>
              Zip <SortIcon field="zip_code" />
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium" onClick={() => handleSort("status")}>
              Status <SortIcon field="status" />
            </button>
          </div>

          {activeEntries.map(entry => {
            const cfg = WAITLIST_STATUS_CONFIG[entry.status] || WAITLIST_STATUS_CONFIG.waiting;
            const Icon = cfg.icon;
            const isOffered = entry.status === "offered";
            const isAccepted = entry.status === "accepted";

            return (
              <div key={entry.id} className={`p-4 rounded-2xl border bg-white ${isOffered ? "border-mint-300 ring-1 ring-mint-200" : ""}`}>
                {/* Scenario label */}
                <div className="text-xs font-mono bg-muted/60 text-muted-foreground rounded-lg px-3 py-1 mb-3 border border-dashed border-border">
                  🧪 {entry._scenario}
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{entry.zip_code}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.business_name} · {entry.plan_type} plan · Position #{entry.position}
                    </p>

                    {isOffered && entry.offer_expires_date && (
                      <div className="mt-2 p-2.5 bg-mint-50 rounded-xl border border-mint-200 text-xs text-mint-700">
                        <p className="font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> A spot is available — act now!</p>
                        <p className="mt-0.5">Offer expires: {moment(entry.offer_expires_date).format("MMM D, YYYY h:mm A")}</p>
                        <p className="mt-0.5">Offer attempt: {entry.offer_count || 0}/3 — after 3 missed offers your entry is cancelled</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {isOffered && (
                      <Button size="sm" className="rounded-xl bg-peach-400 hover:bg-peach-500 text-white text-xs h-7">
                        Subscribe Now →
                      </Button>
                    )}
                    {/* Inline cancel confirm */}
                    {["waiting", "offered"].includes(entry.status) && showConfirm !== entry.id && (
                      <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs text-muted-foreground" onClick={() => setShowConfirm(entry.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Cancel confirmation inline */}
                {showConfirm === entry.id && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-xs space-y-2">
                    <p className="font-semibold text-red-700">Remove yourself from the waitlist for {entry.zip_code}?</p>
                    <p className="text-red-600">You will lose your position #{entry.position} and will need to rejoin at the back of the queue.</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="rounded-xl h-7 text-xs bg-red-500 hover:bg-red-600 text-white" onClick={() => { setCancelled(c => [...c, entry.id]); setShowConfirm(null); }}>
                        Yes, Remove Me
                      </Button>
                      <Button variant="ghost" size="sm" className="rounded-xl h-7 text-xs" onClick={() => setShowConfirm(null)}>Keep My Spot</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pastEntries.length > 0 && (
        <details className="group" open>
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
            <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span>
            {pastEntries.length} past entr{pastEntries.length === 1 ? "y" : "ies"}
          </summary>
          <div className="mt-2 space-y-2">
            {pastEntries.map(entry => {
              const cfg = WAITLIST_STATUS_CONFIG[entry.status] || WAITLIST_STATUS_CONFIG.cancelled;
              const Icon = cfg.icon;
              return (
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-2xl border bg-muted/20 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{entry.zip_code}</span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                    <Icon className="w-3 h-3" />{cfg.label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">{moment(entry.created_date).format("MMM D, YYYY")}</span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

function MockPageHeader({ hasAds }) {
  const totalImpressions = hasAds ? MOCK_ADS.reduce((s, a) => s + (a.impressions || 0), 0) : 0;
  const totalClicks = hasAds ? MOCK_ADS.reduce((s, a) => s + (a.clicks || 0), 0) : 0;
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0.0";
  const activeCount = hasAds ? MOCK_ADS.filter(a => a.status === "active").length : 0;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading font-bold text-xl">Ad Manager</h2>
          <p className="text-sm text-muted-foreground">Manage your Supporter advertising campaigns</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl"><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</Button>
          <Button size="sm" className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white">+ New Ad</Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Eye,               label: "Total Impressions",  value: totalImpressions.toLocaleString() },
          { icon: MousePointerClick, label: "Total Clicks",        value: totalClicks.toLocaleString() },
          { icon: BarChart3,         label: "Click-Through Rate",  value: `${ctr}%` },
          { icon: CheckCircle,       label: "Active Ads",          value: activeCount },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-2xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="font-heading font-bold text-2xl">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs bar */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {[
          { icon: List,   label: `My Ads (${hasAds ? MOCK_ADS.length : 0})` },
          { icon: Images, label: "Ad Library" },
          { icon: Clock,  label: "Waitlist" },
        ].map(({ icon: Icon, label }, i) => (
          <div key={label} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${i === 0 ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </div>
        ))}
      </div>

      {/* My Ads content */}
      {!hasAds ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-border">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-heading font-semibold mb-1">No ads yet</p>
          <p className="text-sm text-muted-foreground mb-4">Submit your first Supporter ad to reach local families.</p>
          <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white">Submit Your First Ad</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {MOCK_ADS.slice(0, 1).map(ad => <MockAdCard key={ad.id} ad={ad} />)}
          <p className="text-xs text-center text-muted-foreground italic">… remaining ad cards continue below …</p>
        </div>
      )}
    </div>
  );
}

export default function AdManagerPreview() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="bg-peach-50 border border-peach-200 rounded-2xl p-4 text-sm text-peach-700">
        <p className="font-semibold mb-1">🧪 Preview Page — Mock Data Only</p>
        <p>This page is for visual testing only. All interactions are simulated. Delete this page when done reviewing.</p>
      </div>

      {/* ── My Ads: Empty state ── */}
      <div>
        <div className="text-xs font-mono bg-muted/60 text-muted-foreground rounded-lg px-3 py-1.5 mb-4 border border-dashed border-border inline-block">
          🧪 Scenario: <strong>My Ads tab — No ads yet (empty state)</strong>
        </div>
        <MockPageHeader hasAds={false} />
      </div>

      <hr className="border-border" />

      {/* ── My Ads: Has ads ── */}
      <div>
        <div className="text-xs font-mono bg-muted/60 text-muted-foreground rounded-lg px-3 py-1.5 mb-4 border border-dashed border-border inline-block">
          🧪 Scenario: <strong>My Ads tab — With active ads (stats populated, "+ New Ad" in header)</strong>
        </div>
        <MockPageHeader hasAds={true} />
      </div>

      <hr className="border-border" />

      {/* ── All Ad Card states ── */}
      <div>
        <h2 className="font-heading font-bold text-xl mb-4">All Ad Card States</h2>
        <div className="space-y-4">
          {MOCK_ADS.map(ad => <MockAdCard key={ad.id} ad={ad} />)}
        </div>
      </div>

      <hr className="border-border" />

      {/* ── Waitlist states ── */}
      <div>
        <h2 className="font-heading font-bold text-xl mb-4">Waitlist States</h2>
        <div className="bg-white rounded-2xl border border-border p-5">
          <MockWaitlistManager />
        </div>
      </div>
    </div>
  );
}