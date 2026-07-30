import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import EventCard from "@/components/events/EventCard";
import { Bookmark } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Input } from "@/components/ui/input";
import moment from "moment";

const DATE_FILTERS = [
  { id: "all", label: "All" },
  { id: "current", label: "Current" },
  { id: "expired", label: "Expired" },
];

/** Effective last day of the activity (end_date if set, otherwise start_date). */
function activityEndDay(event) {
  const raw = event.end_date || event.start_date;
  if (!raw) return null;
  return moment(raw).startOf("day");
}

function isCurrentActivity(event, today) {
  const end = activityEndDay(event);
  if (!end) return false;
  return end.isSameOrAfter(today, "day");
}

function isExpiredActivity(event, today) {
  const end = activityEndDay(event);
  if (!end) return false;
  return end.isBefore(today, "day");
}

export default function SavedActivitiesTab({ user }) {
  const navigate = useNavigate();
  const [savedEvents, setSavedEvents] = useState([]);
  const [savedRecords, setSavedRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: saves, error } = await supabase
        .from("saved_events")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setSavedRecords(saves || []);
      const savedIds = (saves || []).map((s) => s.event_id);
      if (savedIds.length > 0) {
        const { data: events, error: eventsError } = await supabase
          .from("events")
          .select("*")
          .in("id", savedIds)
          .eq("status", "active");
        if (eventsError) throw eventsError;
        setSavedEvents(events || []);
      } else {
        setSavedEvents([]);
      }
    } catch {
      setSavedRecords([]);
      setSavedEvents([]);
    }
    setLoading(false);
  };

  const handleToggleSave = async (eventId) => {
    const record = savedRecords.find((r) => r.event_id === eventId);
    if (record) {
      const event = savedEvents.find((e) => e.id === eventId);
      await supabase.from("saved_events").delete().eq("id", record.id);
      if (event) {
        await supabase
          .from("events")
          .update({ save_count: Math.max(0, (event.save_count || 0) - 1) })
          .eq("id", eventId);
      }
      setSavedRecords((prev) => prev.filter((r) => r.event_id !== eventId));
      setSavedEvents((prev) => prev.filter((e) => e.id !== eventId));
    }
  };

  const filteredEvents = useMemo(() => {
    const today = moment().startOf("day");
    let list = [...savedEvents];

    if (dateFilter === "current") {
      list = list.filter((e) => isCurrentActivity(e, today));
    } else if (dateFilter === "expired") {
      list = list.filter((e) => isExpiredActivity(e, today));
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const hay = [
          e.title,
          e.city,
          e.state,
          e.organization_name,
          e.zip_code,
          e.category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    // Keep date-saved order (newest save first)
    list.sort((a, b) => {
      const aDate = savedRecords.find((r) => r.event_id === a.id)?.created_at || 0;
      const bDate = savedRecords.find((r) => r.event_id === b.id)?.created_at || 0;
      return new Date(bDate) - new Date(aDate);
    });

    return list;
  }, [savedEvents, savedRecords, search, dateFilter]);

  if (loading) {
    return <LoadingState text="Loading your saved activities..." />;
  }

  if (savedEvents.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No Saved Activities"
        description={
          <>
            If you run across an Activity you want to follow, press the{" "}
            <Bookmark className="inline-block w-3.5 h-3.5 align-text-bottom text-muted-foreground" aria-label="save" />{" "}
            button to make it appear on this page. Then, you can also press the same icon on the homepage to filter for your Saved Activities.
          </>
        }
        actionLabel="Browse Activities"
        onAction={() => navigate("/")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Activities you&apos;ve bookmarked so you can find them again later.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <Input
          placeholder="Search saved activities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-xl h-9 text-sm sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDateFilter(f.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                dateFilter === f.id
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
          No saved activities match your search or filter.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              isSaved
              onToggleSave={handleToggleSave}
              backLabel="Back to Saved Activities"
            />
          ))}
        </div>
      )}
    </div>
  );
}
