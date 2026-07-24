import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, ChevronUp, RotateCcw, Star, HelpCircle, Loader2, Clock,
} from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import moment from "moment";
import {
  QUEUE_STATUSES,
  compareWaitlistEntries,
  renumberZipQueue,
} from "@/lib/waitlistQueue";

const STATUS_COLOR = {
  waiting: "bg-yellow-100 text-yellow-700",
  offered: "bg-blue-100 text-blue-600",
  accepted: "bg-mint-100 text-mint-600",
  expired: "bg-gray-100 text-gray-500",
  declined: "bg-gray-100 text-gray-500",
  cancelled: "bg-gray-100 text-gray-500",
};

async function adminPost(path, body) {
  const { data: sessionData, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("You must be signed in");

  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const raw = await res.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }
  if (!res.ok) {
    throw new Error(payload.error || (raw && raw.length < 200 ? raw : `Request failed (${res.status})`));
  }
  return payload;
}

export default function AdminWaitlistPanel({ toast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [overrideNotes, setOverrideNotes] = useState({});
  const [saving, setSaving] = useState(null);
  const [runningProcessor, setRunningProcessor] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ad_waitlist")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      if (error) throw error;
      const rows = data || [];

      // Heal duplicate positions (e.g. both showing #1) for each zip.
      const zips = [...new Set(rows.map((r) => r.zip_code).filter(Boolean))];
      for (const zip of zips) {
        try {
          await renumberZipQueue(supabase, zip);
        } catch {
          /* non-fatal — still show current rows */
        }
      }

      const { data: refreshed } = await supabase
        .from("ad_waitlist")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(200);
      setEntries(refreshed || rows);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  };

  const handleRunProcessor = async () => {
    setRunningProcessor(true);
    try {
      const result = await adminPost("/api/process-waitlist", {});
      toast?.({
        title: "Waitlist processor ran",
        description: `Expired ${result.expired || 0}, cancelled ${result.cancelled || 0}, offers sent ${result.offers_sent || 0}.`,
      });
      load();
    } catch (err) {
      toast?.({ title: "Processor failed", description: err.message, variant: "destructive" });
    }
    setRunningProcessor(false);
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
      try {
        await renumberZipQueue(supabase, entry.zip_code);
      } catch {}
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

  const handleExpireOfferNow = async (entry) => {
    if (
      !window.confirm(
        `Expire the offer for ${entry.business_name} now? They go to the back of the line (or cancel after 3 misses), and the processor can offer the next person.`
      )
    ) return;
    setSaving(entry.id);
    try {
      const result = await adminPost("/api/expire-waitlist-offer", {
        waitlist_entry_id: entry.id,
      });
      toast?.({
        title: "Offer expired — processor ran",
        description: `Expired ${result.expired || 0}, cancelled ${result.cancelled || 0}, new offers sent ${result.offers_sent || 0}.`,
      });
      load();
    } catch (err) {
      toast?.({ title: "Failed to expire offer", description: err.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleOfferSpot = async (entry) => {
    setSaving(entry.id);
    try {
      const notes = overrideNotes[entry.id] || "";
      const result = await adminPost("/api/offer-waitlist-spot", {
        waitlist_entry_id: entry.id,
        ...(notes ? { admin_override_notes: notes } : {}),
      });
      toast?.({
        title: result.email_sent ? "Offer sent" : "Offer saved (email failed)",
        description: result.email_sent
          ? `${entry.business_name} was emailed — they can claim zip ${entry.zip_code} from Ad Manager → Waitlist (24 hours).`
          : result.email_error || "Spot offered in the database, but the email did not send.",
        variant: result.email_sent ? undefined : "destructive",
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
    byZip[zip].sort(compareWaitlistEntries);
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
        Custom Zip Code Configurations — raise max slots separately if you want more capacity. A cron job
        also expires stale offers and advances the queue every 30 minutes.
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
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl shrink-0"
          disabled={runningProcessor}
          onClick={handleRunProcessor}
        >
          {runningProcessor ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Run processor
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
          const activeCount = zipEntries.filter((e) => QUEUE_STATUSES.includes(e.status)).length;
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
                    const isActive = QUEUE_STATUSES.includes(entry.status);
                    const queueRank = isActive
                      ? zipEntries.filter((e) => QUEUE_STATUSES.includes(e.status)).findIndex((e) => e.id === entry.id) + 1
                      : null;
                    return (
                      <div key={entry.id} className={`px-4 py-3 ${!isActive ? "bg-muted/20" : ""}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {queueRank != null && (
                                <span className="text-xs font-bold text-muted-foreground w-5">
                                  #{queueRank}
                                </span>
                              )}
                              <span className="font-medium text-sm">{entry.business_name || "—"}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                {entry.status}
                              </span>
                              {Number(entry.offer_count || 0) > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  Missed offers: {entry.offer_count}/3
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
                                {entry.status === "offered" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs rounded-xl flex-1 text-peach-600 border-peach-200"
                                    disabled={saving === entry.id}
                                    onClick={() => handleExpireOfferNow(entry)}
                                  >
                                    {saving === entry.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Clock className="w-3 h-3 mr-1" />
                                    )}
                                    Expire offer now
                                  </Button>
                                )}
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
                                {queueRank !== 1 && entry.status === "waiting" && (
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
