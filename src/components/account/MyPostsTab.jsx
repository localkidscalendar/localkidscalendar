import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  CalendarDays, Edit, Copy, Eye, Bookmark, MessageSquare, TrendingUp, Trash2, RotateCcw, Flag,
} from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import SearchClearField from "@/components/shared/SearchClearField";
import moment from "moment";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "inactive", label: "Inactive" },
];

/** Live on the site (date expiry alone does not count as inactive). */
function isActivePost(event) {
  return event.status === "active";
}

/** Taken down — community flags, admin disable/removal, or user deactivate. */
function isInactivePost(event) {
  return !isActivePost(event);
}

/** Pill label for inactive posts (filter chips stay All / Active / Inactive). */
function inactiveStatusPill(event) {
  if (event.status === "archived" && Number(event.flag_count || 0) >= 3) {
    return "Inactive: 3-User Flags";
  }
  if (event.status === "deleted" && event.admin_notes) {
    return "Inactive: Admin Removed";
  }
  if (event.status === "deleted") {
    return "Inactive: User Deactivated";
  }
  if (event.status === "archived") {
    return "Inactive: Admin Removed";
  }
  return "Inactive";
}

export default function MyPostsTab({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myEvents, setMyEvents] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("created_by_id", user.id)
        .in("status", ["active", "deleted", "archived"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = data || [];
      setMyEvents(rows);

      const countsMap = {};
      await Promise.all(
        rows.map(async (e) => {
          const { count } = await supabase
            .from("comments")
            .select("*", { count: "exact", head: true })
            .eq("event_id", e.id)
            .eq("status", "active");
          countsMap[e.id] = count || 0;
        })
      );
      setCommentCounts(countsMap);
    } catch {
      setMyEvents([]);
      setCommentCounts({});
    }
    setLoading(false);
  };

  const filteredEvents = useMemo(() => {
    let list = [...myEvents];
    if (statusFilter === "active") list = list.filter(isActivePost);
    else if (statusFilter === "inactive") list = list.filter(isInactivePost);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const hay = [e.title, e.city, e.state, e.organization_name, e.zip_code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [myEvents, search, statusFilter]);

  const handleMarkFull = async (eventId) => {
    const { error } = await supabase.from("events").update({ registration_full: true }).eq("id", eventId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    loadData();
  };

  const handleDeactivate = async (event) => {
    if (!window.confirm(`Deactivate "${event.title}"? This will remove it from the public site until you reactivate it. NOTE: If your activity is complete, we recommend keeping it active (rather than removing it) in case users are searching for it in the past.`)) return;
    const { error } = await supabase
      .from("events")
      .update({ status: "deleted", admin_notes: "" })
      .eq("id", event.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Activity deactivated" });
    loadData();
  };

  const handleReactivate = async (event) => {
    if (!window.confirm(`Reactivate "${event.title}"? This will make it visible on the public site again.`)) return;
    const { error } = await supabase.from("events").update({ status: "active" }).eq("id", event.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Activity reactivated" });
    loadData();
  };

  if (loading) {
    return <LoadingState text="Loading your posts..." />;
  }

  if (myEvents.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No Activities Posted"
        description="Share your first activity with the community."
        actionLabel="Post Your First Activity"
        onAction={() => navigate("/post-event")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Activities you&apos;ve posted. Edit, duplicate, or deactivate them from here.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <SearchClearField
          placeholder="Search your posts…"
          value={search}
          onValueChange={setSearch}
          inputClassName="rounded-xl h-9 text-sm flex-1 min-w-0"
        />
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === f.id
                  ? "bg-mint-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No posts match your search or filter.
        </p>
      ) : (
        filteredEvents.map((e) => {
          const active = isActivePost(e);
          const canSelfReactivate = e.status === "deleted" && !e.admin_notes;
          return (
            <div key={e.id} className="bg-white rounded-2xl border border-border p-4">
              {/* Mobile: actions on top row; Desktop: title left / actions top-right */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                {active ? (
                  <div className="flex items-center justify-end gap-1 -mt-1 -mr-1 order-1 sm:order-2 sm:shrink-0">
                    {!e.registration_full && (
                      <Button variant="ghost" size="sm" className="rounded-lg text-xs h-8 px-2" onClick={() => handleMarkFull(e.id)}>
                        Mark Full
                      </Button>
                    )}
                    {e.registration_full && (
                      <span className="text-xs text-peach-500 font-medium px-2">Full</span>
                    )}
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => navigate(`/post-event?edit=${e.id}`)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => navigate(`/post-event?duplicate=${e.id}`)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => handleDeactivate(e)} title="Deactivate">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1 -mt-1 -mr-1 order-1 sm:order-2 sm:shrink-0">
                    <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8" onClick={() => navigate(`/post-event?duplicate=${e.id}`)} title="Duplicate">
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {canSelfReactivate && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-xs text-mint-600 border-mint-200 h-8"
                        onClick={() => handleReactivate(e)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reactivate
                      </Button>
                    )}
                  </div>
                )}

                {active ? (
                  <Link
                    to={`/event/${e.id}`}
                    state={{ fromApp: true, backLabel: "Back to My Activity Posts" }}
                    className="block min-w-0 order-2 sm:order-1 sm:flex-1"
                  >
                    <div className="flex items-start gap-2">
                      <p className="font-medium text-sm hover:text-mint-500 transition-colors min-w-0 flex-1 sm:truncate">
                        {e.title}
                      </p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-mint-50 text-mint-600 shrink-0 mt-0.5">
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {moment(e.start_date).format("MMM D, YYYY")} · {e.city}, {e.state}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="w-3.5 h-3.5" /> {e.impression_count || 0} impressions
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3.5 h-3.5" /> {e.view_count || 0} views
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Bookmark className="w-3.5 h-3.5" /> {e.save_count || 0} saves
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="w-3.5 h-3.5" /> {commentCounts[e.id] || 0} comments
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Flag className="w-3.5 h-3.5" /> {e.flag_count || 0} of 3 flags
                      </span>
                    </div>
                  </Link>
                ) : (
                  <div className="min-w-0 order-2 sm:order-1 sm:flex-1">
                    <div className="flex items-start gap-2">
                      <p className="font-medium text-sm min-w-0 flex-1 sm:truncate">{e.title}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground shrink-0 mt-0.5 max-w-[11rem] text-center leading-snug">
                        {inactiveStatusPill(e)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {moment(e.start_date).format("MMM D, YYYY")} · {e.city}, {e.state}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="w-3.5 h-3.5" /> {e.impression_count || 0} impressions
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3.5 h-3.5" /> {e.view_count || 0} views
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Bookmark className="w-3.5 h-3.5" /> {e.save_count || 0} saves
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MessageSquare className="w-3.5 h-3.5" /> {commentCounts[e.id] || 0} comments
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Flag className="w-3.5 h-3.5" /> {e.flag_count || 0} of 3 flags
                      </span>
                    </div>
                  </div>
                )}
              </div>
              {e.status === "deleted" && e.admin_notes && (
                <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700">
                  <p className="font-semibold mb-1">Reason for removal:</p>
                  <p>{e.admin_notes}</p>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
