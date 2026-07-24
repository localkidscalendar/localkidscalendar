import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  Loader2, Clock, XCircle, MapPin, AlertCircle,
  PartyPopper, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import { nextPositionForZip, countOpenAdSlots } from "@/lib/waitlistQueue";

const STATUS_CONFIG = {
  waiting: { label: "Waiting", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  offered: { label: "Offer Sent!", color: "bg-mint-100 text-mint-600", icon: AlertCircle },
  accepted: { label: "Claimed! ✓", color: "bg-mint-100 text-mint-600", icon: PartyPopper },
  expired: { label: "Offer Expired", color: "bg-gray-100 text-gray-500", icon: XCircle },
  declined: { label: "Declined", color: "bg-gray-100 text-gray-500", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500", icon: XCircle },
};

const ACTIVE_STATUSES = ["waiting", "offered", "accepted"];
const PAST_STATUSES = ["expired", "declined", "cancelled"];

async function zipHasOpenSlot(zip) {
  const open = await countOpenAdSlots(supabase, zip);
  return open > 0;
}

/** Join a zip waitlist from New Ad when zip is full. */
export async function joinAdWaitlist({ user, zipCode, planType = "monthly", businessName }) {
  const zip = (zipCode || "").trim();
  if (!/^\d{5}$/.test(zip)) throw new Error("Enter a valid 5-digit zip code");

  const { data: existing } = await supabase
    .from("ad_waitlist")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("zip_code", zip)
    .in("status", ["waiting", "offered", "accepted"])
    .maybeSingle();
  if (existing) throw new Error(`You're already on the waitlist for ${zip}`);

  const open = await zipHasOpenSlot(zip);
  if (open) throw new Error(`Zip ${zip} currently has an open spot — submit a new ad instead of joining the waitlist.`);

  const position = await nextPositionForZip(supabase, zip);
  const { data, error } = await supabase
    .from("ad_waitlist")
    .insert({
      user_id: user.id,
      email: user.email || "",
      business_name: businessName || user.full_name || user.business_name || "Supporter",
      zip_code: zip,
      plan_type: planType,
      position,
      status: "waiting",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export default function WaitlistManager({ user, onClaimSpot }) {
  const { toast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    if (user) loadEntries();
  }, [user]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ad_waitlist")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setEntries(data || []);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  };

  const handleCancel = async (entry) => {
    if (!window.confirm("Remove yourself from this waitlist?")) return;
    try {
      const { error } = await supabase
        .from("ad_waitlist")
        .update({ status: "cancelled" })
        .eq("id", entry.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, status: "cancelled" } : e)));
      toast({ title: "Removed from waitlist" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortEntries = (list) => {
    if (!sortField) return list;
    return [...list].sort((a, b) => {
      const aVal = (a[sortField] || "").toString().toLowerCase();
      const bVal = (b[sortField] || "").toString().toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const activeEntries = sortEntries(entries.filter((e) => ACTIVE_STATUSES.includes(e.status)));
  const pastEntries = entries.filter((e) => PAST_STATUSES.includes(e.status));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading font-semibold">Waitlisted Zip Codes</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Join from <strong>New Ad</strong> when a zip is full. When a spot is offered, claim it here.
        </p>
      </div>

      {activeEntries.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">No active waitlist entries.</p>
      )}

      {activeEntries.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1 pb-1">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium"
              onClick={() => handleSort("zip_code")}
            >
              Zip <SortIcon field="zip_code" />
            </button>
            <span className="text-muted-foreground/40">·</span>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium"
              onClick={() => handleSort("status")}
            >
              Status <SortIcon field="status" />
            </button>
          </div>
          {activeEntries.map((entry) => {
            const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.waiting;
            const Icon = cfg.icon;
            const isOffered = entry.status === "offered";
            const isAccepted = entry.status === "accepted";

            return (
              <div
                key={entry.id}
                className={`p-4 rounded-2xl border bg-white ${isOffered ? "border-mint-300 ring-1 ring-mint-200" : isAccepted ? "border-mint-200 bg-mint-50/30" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{entry.zip_code}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                        <Icon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {entry.business_name} · {entry.plan_type} plan
                      {!isAccepted && ` · Position #${entry.position}`}
                    </p>

                    {isOffered && (
                      <div className="mt-2 p-2.5 bg-mint-50 rounded-xl border border-mint-200 text-xs text-mint-700">
                        <p className="font-semibold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> A spot is available — act now!
                        </p>
                        {entry.offer_expires_date && (
                          <p className="mt-0.5">
                            Offer expires: {moment(entry.offer_expires_date).format("MMM D, YYYY h:mm A")}
                          </p>
                        )}
                        <p className="mt-0.5">
                          Offer attempt: {entry.offer_count || 0}/3 — after 3 missed offers your entry is cancelled
                        </p>
                      </div>
                    )}

                    {isAccepted && (
                      <div className="mt-2 p-2.5 bg-mint-50 rounded-xl border border-mint-200 text-xs text-mint-700">
                        <p className="font-semibold">You successfully claimed this spot!</p>
                        <p className="mt-0.5 text-muted-foreground">Check the My Ads tab for status updates.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 shrink-0">
                    {isOffered && onClaimSpot && (
                      <Button
                        size="sm"
                        className="rounded-xl bg-peach-400 hover:bg-peach-500 text-white text-xs h-7"
                        onClick={() => onClaimSpot(entry)}
                      >
                        Claim Spot →
                      </Button>
                    )}
                    {["waiting", "offered"].includes(entry.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl h-7 text-xs text-muted-foreground"
                        onClick={() => handleCancel(entry)}
                      >
                        Leave
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pastEntries.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground list-none flex items-center gap-1">
            <span className="group-open:hidden">▸</span>
            <span className="hidden group-open:inline">▾</span>
            {pastEntries.length} past entr{pastEntries.length === 1 ? "y" : "ies"}
          </summary>
          <div className="mt-2 space-y-2">
            {pastEntries.map((entry) => {
              const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.cancelled;
              const Icon = cfg.icon;
              return (
                <div key={entry.id} className="flex items-center gap-3 p-3 rounded-2xl border bg-muted/20 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{entry.zip_code}</span>
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {moment(entry.created_at).format("MMM D, YYYY")}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
