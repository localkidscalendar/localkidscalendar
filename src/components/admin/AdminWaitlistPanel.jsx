import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, RotateCcw, Star, HelpCircle, Loader2 } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import moment from "moment";

const STATUS_COLOR = {
  waiting:  "bg-yellow-100 text-yellow-700",
  offered:  "bg-blue-100 text-blue-600",
  accepted: "bg-mint-100 text-mint-600",
  expired:  "bg-gray-100 text-gray-500",
  declined: "bg-gray-100 text-gray-500",
  cancelled:"bg-gray-100 text-gray-500",
};

export default function AdminWaitlistPanel({ toast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [overrideNotes, setOverrideNotes] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const items = await base44.entities.AdWaitlist.list("-created_date", 200);
      setEntries(items);
    } catch { setEntries([]); }
    setLoading(false);
  };

  // Move entry to front of queue for its zip code
  const handleMoveToFront = async (entry) => {
    if (!window.confirm(`Move ${entry.business_name} (${entry.zip_code}) to the front of the queue?`)) return;
    setSaving(entry.id);
    try {
      // Shift all other waiting entries for this zip up by 1
      const sameZip = entries.filter(e => e.zip_code === entry.zip_code && e.status === "waiting" && e.id !== entry.id);
      for (const e of sameZip) {
        await base44.entities.AdWaitlist.update(e.id, { position: (e.position || 1) + 1 });
      }
      const notes = overrideNotes[entry.id] || "";
      await base44.entities.AdWaitlist.update(entry.id, {
        position: 1,
        ...(notes ? { admin_override_notes: notes } : {}),
      });
      toast({ title: `${entry.business_name} moved to front of zip ${entry.zip_code} queue` });
      load();
    } catch {
      toast({ title: "Failed to update position", variant: "destructive" });
    }
    setSaving(null);
  };

  // Reset offer count so the user gets 3 fresh attempts
  const handleResetOfferCount = async (entry) => {
    if (!window.confirm(`Reset offer count for ${entry.business_name}? They will get 3 fresh offer attempts.`)) return;
    setSaving(entry.id);
    try {
      const notes = overrideNotes[entry.id] || "";
      await base44.entities.AdWaitlist.update(entry.id, {
        offer_count: 0,
        status: entry.status === "cancelled" ? "waiting" : entry.status,
        offer_sent_date: null,
        offer_expires_date: null,
        ...(notes ? { admin_override_notes: notes } : {}),
      });
      toast({ title: `Offer count reset for ${entry.business_name}` });
      load();
    } catch {
      toast({ title: "Failed to reset offer count", variant: "destructive" });
    }
    setSaving(null);
  };

  const filtered = entries.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (e.business_name || "").toLowerCase().includes(s) ||
      (e.zip_code || "").includes(s) ||
      (e.email || "").toLowerCase().includes(s) ||
      (e.status || "").includes(s);
  });

  // Group by zip for display
  const byZip = {};
  for (const e of filtered) {
    if (!byZip[e.zip_code]) byZip[e.zip_code] = [];
    byZip[e.zip_code].push(e);
  }
  for (const zip of Object.keys(byZip)) {
    byZip[zip].sort((a, b) => {
      // Sort active entries by position first, then by status
      const aActive = ["waiting", "offered"].includes(a.status);
      const bActive = ["waiting", "offered"].includes(b.status);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return (a.position || 999) - (b.position || 999);
    });
  }
  const zips = Object.keys(byZip).sort();

  if (loading) return <LoadingState text="Loading waitlist entries..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by business, zip, email, or status…"
          value={search}
          onChange={e => setSearch(e.target.value)}
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
        {zips.map(zip => {
          const zipEntries = byZip[zip];
          const activeCount = zipEntries.filter(e => ["waiting", "offered"].includes(e.status)).length;
          const isExpanded = expandedId === zip;

          return (
            <div key={zip} className="bg-white rounded-2xl border border-border overflow-hidden">
              {/* Zip header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(prev => prev === zip ? null : zip)}
              >
                <div className="flex items-center gap-3">
                  <span className="font-heading font-semibold text-sm">Zip {zip}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                    {activeCount} active
                  </span>
                  <span className="text-xs text-muted-foreground">{zipEntries.length} total entries</span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>

              {/* Entries table */}
              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {zipEntries.map((entry, idx) => {
                    const statusColor = STATUS_COLOR[entry.status] || STATUS_COLOR.waiting;
                    const isActive = ["waiting", "offered"].includes(entry.status);
                    return (
                      <div key={entry.id} className={`px-4 py-3 ${!isActive ? "bg-muted/20" : ""}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isActive && <span className="text-xs font-bold text-muted-foreground w-5">#{entry.position}</span>}
                              <span className="font-medium text-sm">{entry.business_name || "—"}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                                {entry.status}
                              </span>
                              {entry.offer_count > 0 && (
                                <span className="text-xs text-muted-foreground">Offers sent: {entry.offer_count}/3</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground space-x-3">
                              <span>{entry.email}</span>
                              <span className="capitalize">{entry.plan_type} plan</span>
                              {entry.offer_expires_date && entry.status === "offered" && (
                                <span className="text-peach-500">Expires {moment(entry.offer_expires_date).fromNow()}</span>
                              )}
                              <span>Joined {moment.utc(entry.created_date).local().format("MMM D, YYYY")}</span>
                            </div>
                            {entry.admin_override_notes && (
                              <p className="text-xs text-peach-600 bg-peach-50 rounded px-2 py-1">
                                Admin note: {entry.admin_override_notes}
                              </p>
                            )}
                          </div>

                          {/* Admin actions — only for active entries */}
                          {isActive && (
                            <div className="flex flex-col gap-2 shrink-0 min-w-[200px]">
                              <Input
                                placeholder="Override note (optional)…"
                                className="h-7 text-xs rounded-lg"
                                value={overrideNotes[entry.id] || ""}
                                onChange={e => setOverrideNotes(prev => ({ ...prev, [entry.id]: e.target.value }))}
                              />
                              <div className="flex gap-1.5">
                                {entry.position !== 1 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs rounded-xl flex-1 text-mint-600 border-mint-200"
                                    disabled={saving === entry.id}
                                    onClick={() => handleMoveToFront(entry)}
                                  >
                                    {saving === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3 mr-1" />}
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
                                    {saving === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                                    Reset Offers
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* For cancelled entries, allow re-adding to queue */}
                          {entry.status === "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs rounded-xl text-mint-600 border-mint-200 shrink-0"
                              disabled={saving === entry.id}
                              onClick={() => handleResetOfferCount(entry)}
                            >
                              {saving === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3 mr-1" />}
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