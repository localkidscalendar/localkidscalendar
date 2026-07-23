import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, ChevronUp, RotateCcw, Star, HelpCircle, Loader2, Clock,
} from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import moment from "moment";

const STATUS_COLOR = {
  waiting: "bg-yellow-100 text-yellow-700",
  offered: "bg-blue-100 text-blue-600",
  accepted: "bg-mint-100 text-mint-600",
  expired: "bg-gray-100 text-gray-500",
  declined: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

const SLOT_HOLDING = ["active", "pending_payment", "pending_review", "flagged", "past_due"];

async function zipOpenSlotCount(zip) {
  const [{ data: zipConfig }, { data: holding }] = await Promise.all([
    supabase.from("ad_zip_config").select("max_slots").eq("zip_code", zip).maybeSingle(),
    supabase.from("banner_ads").select("id").eq("zip_code", zip).in("status", SLOT_HOLDING),
  ]);
  const maxSlots = Number(zipConfig?.max_slots) || 3;
  return Math.max(0, maxSlots - (holding || []).length);
}

export default function AdminWaitlistPanel({ toast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [overrideNotes, setOverrideNotes] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ad_waitlist")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setEntries(data || []);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  };

  const handleMoveToFront = async (entry) => {
    if (!window.confirm(`Move ${entry.business_name} (${entry.zip_code}) to the front of the queue?`)) return;
    setSaving(entry.id);
    try {
      const sameZip = entries.filter(
        (e) => e.zip_code === entry.zip_code && e.status === "waiting" && e.id !== entry.id
      );
      for (const e of sameZip) {
        const { error } = await supabase
          .from("ad_waitlist")
          .update({ position: Number(e.position || 1) + 1, updated_at: new Date().toISOString() })
          .eq("id", e.id);
        if (error) throw error;
      }
      const notes = overrideNotes[entry.id] || "";
      const { error } = await supabase
        .from("ad_waitlist")
        .update({
          position: 1,
          ...(notes ? { admin_override_notes: notes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);
      if (error) throw error;
      toast?.({ title: `${entry.business_name} moved to front of zip ${entry.zip_code} queue` });
      load();
    } catch (err) {
      toast?.({ title: "Failed to update position", description: err.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleResetOfferCount = async (entry) => {
    const reAdd = entry.status === "cancelled";
    if (
      !window.confirm(
        reAdd
          ? `Re-add ${entry.business_name} to the waitlist queue?`
          : `Reset offer count for ${entry.business_name}? They will get 3 fresh offer attempts.`
      )
    ) return;
    setSaving(entry.id);
    try {
      const notes = overrideNotes[entry.id] || "";
      let position = entry.position;
      if (reAdd) {
        const { count } = await supabase
          .from("ad_waitlist")
          .select("id", { count: "exact", head: true })
          .eq("zip_code", entry.zip_code)
          .eq("status", "waiting");
        position = (count || 0) + 1;
      }
      const { error } = await supabase
        .from("ad_waitlist")
        .update({
          offer_count: 0,
          status: reAdd ? "waiting" : entry.status === "cancelled" ? "waiting" : entry.status,
          position,
          offer_sent_date: null,
          offer_expires_date: null,
          ...(notes ? { admin_override_notes: notes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);
      if (error) throw error;
      toast?.({ title: reAdd ? `Re-added ${entry.business_name} to queue` : `Offer count reset for ${entry.business_name}` });
      load();
    } catch (err) {
      toast?.({ title: "Failed to reset", description: err.message, variant: "destructive" });
    }
    setSaving(null);
  };

  /**
   * Manual offer for beta. Does NOT increase Custom Zip Configurations.
   * Only works when the zip already has an open slot (someone left, or admin raised max_slots).
   */
  const handleOfferSpot = async (entry) => {
    setSaving(entry.id);
    try {
      const open = await zipOpenSlotCount(entry.zip_code);
      if (open <= 0) {
        toast?.({
          title: "No open slot in this zip",
          description:
            "Offering does not increase capacity. Free a placement or raise max slots under Custom Zip Code Configurations first.",
          variant: "destructive",
        });
        setSaving(null);
        return;
      }
      const hasActiveOffer = entries.some(
        (e) =>
          e.zip_code === entry.zip_code &&
          e.status === "offered" &&
          e.id !== entry.id &&
          e.offer_expires_date &&
          new Date(e.offer_expires_date) > new Date()
      );
      if (hasActiveOffer) {
        toast?.({
          title: "An offer is already active for this zip",
          description: "Wait for it to be claimed or expire before offering another.",
          variant: "destructive",
        });
        setSaving(null);
        return;
      }
      const expires = new Date();
      expires.setHours(expires.getHours() + 24);
      const notes = overrideNotes[entry.id] || "";
      const { error } = await supabase
        .from("ad_waitlist")
        .update({
          status: "offered",
          offer_sent_date: new Date().toISOString(),
          offer_expires_date: expires.toISOString(),
          offer_count: Number(entry.offer_count || 0) + 1,
          ...(notes ? { admin_override_notes: notes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.id);
      if (error) throw error;
      toast?.({
        title: "Offer sent",
        description: `${entry.business_name} can claim zip ${entry.zip_code} from Ad Manager → Waitlist (24 hours). Capacity unchanged.`,
      });
      load();
    } catch (err) {
      toast?.({ title: "Failed to offer spot", description: err.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const filtered = entries.filter((e) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (e.business_name || "").toLowerCase().includes(s) ||
      (e.zip_code || "").includes(s) ||
      (e.email || "").toLowerCase().includes(s) ||
      (e.status || "").includes(s)
    );
  });

  const byZip = {};
  for (const e of filtered) {
    if (!byZip[e.zip_code]) byZip[e.zip_code] = [];
    byZip[e.zip_code].push(e);
  }
  for (const zip of Object.keys(byZip)) {
    byZip[zip].sort((a, b) => {
      const aActive = ["waiting", "offered"].includes(a.status);
      const bActive = ["waiting", "offered"].includes(b.status);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return Number(a.position || 999) - Number(b.position || 999);
    });
  }
  const zips = Object.keys(byZip).sort();

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Offers notify the next Supporter when a slot is already open. They do <strong>not</strong> increase
        Custom Zip Code Configurations — raise max slots separately if you want more capacity.
      </p>
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by business, zip, email, or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg h-8 text-sm"
        />
        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={load}>
          Refresh
        </Button>
      </div>

      {zips.length === 0 && (
        <EmptyState
          icon={HelpCircle}
          title="No Waitlist Entries"
          description="Businesses will appear here when they join the waitlist for ad slots."
        />
      )}

      <div className="space-y-3">
        {zips.map((zip) => {
          const zipEntries = byZip[zip];
          const activeCount = zipEntries.filter((e) => ["waiting", "offered"].includes(e.status)).length;
          const isExpanded = expandedId === zip;

          return (
            <div key={zip} className="bg-muted/20 rounded-xl border border-border overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId((prev) => (prev === zip ? null : zip))}
              >
                <div className="flex items-center gap-3">
                  <span className="font-heading font-semibold text-sm">Zip {zip}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                    {activeCount} active
                  </span>
                  <span className="text-xs text-muted-foreground">{zipEntries.length} total entries</span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {zipEntries.map((entry) => {
                    const statusColor = STATUS_COLOR[entry.status] || STATUS_COLOR.waiting;
                    const isActive = ["waiting", "offered"].includes(entry.status);
                    return (
                      <div key={entry.id} className={`px-4 py-3 ${!isActive ? "bg-muted/20" : ""}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isActive && (
                                <span className="text-xs font-bold text-muted-foreground w-5">
                                  #{entry.position}
                                </span>
                              )}
                              <span className="font-medium text-sm">{entry.business_name || "—"}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                {entry.status}
                              </span>
                              {entry.offer_count > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Offers sent: {entry.offer_count}/3
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground space-x-3">
                              <span>{entry.email}</span>
                              <span className="capitalize">{entry.plan_type} plan</span>
                              {entry.offer_expires_date && entry.status === "offered" && (
                                <span className="text-peach-500">
                                  Expires {moment(entry.offer_expires_date).fromNow()}
                                </span>
                              )}
                              <span>Joined {moment(entry.created_at).format("MMM D, YYYY")}</span>
                            </div>
                            {entry.admin_override_notes && (
                              <p className="text-xs text-peach-600 bg-peach-50 rounded px-2 py-1">
                                Admin note: {entry.admin_override_notes}
                              </p>
                            )}
                          </div>

                          {isActive && (
                            <div className="flex flex-col gap-2 shrink-0 min-w-[200px]">
                              <Input
                                placeholder="Override note (optional)…"
                                className="h-7 text-xs rounded-lg"
                                value={overrideNotes[entry.id] || ""}
                                onChange={(e) =>
                                  setOverrideNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))
                                }
                              />
                              <div className="flex gap-1.5 flex-wrap">
                                {entry.status === "waiting" && (
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs rounded-xl flex-1 bg-mint-500 hover:bg-mint-600 text-white"
                                    disabled={saving === entry.id}
                                    onClick={() => handleOfferSpot(entry)}
                                  >
                                    {saving === entry.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Clock className="w-3 h-3 mr-1" />
                                    )}
                                    Offer Spot
                                  </Button>
                                )}
                                {entry.position !== 1 && entry.status === "waiting" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs rounded-xl flex-1 text-mint-600 border-mint-200"
                                    disabled={saving === entry.id}
                                    onClick={() => handleMoveToFront(entry)}
                                  >
                                    {saving === entry.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Star className="w-3 h-3 mr-1" />
                                    )}
                                    Move to Front
                                  </Button>
                                )}
                                {entry.offer_count > 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs rounded-xl flex-1 text-peach-500 border-peach-200"
                                    disabled={saving === entry.id}
                                    onClick={() => handleResetOfferCount(entry)}
                                  >
                                    {saving === entry.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-3 h-3 mr-1" />
                                    )}
                                    Reset Offers
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {entry.status === "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs rounded-xl text-mint-600 border-mint-200 shrink-0"
                              disabled={saving === entry.id}
                              onClick={() => handleResetOfferCount(entry)}
                            >
                              {saving === entry.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3 mr-1" />
                              )}
                              Re-add to Queue
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
