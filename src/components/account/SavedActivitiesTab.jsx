import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import EventCard from "@/components/events/EventCard";
import { Bookmark, ArrowUpDown } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SavedActivitiesTab({ user }) {
  const navigate = useNavigate();
  const [savedEvents, setSavedEvents] = useState([]);
  const [savedRecords, setSavedRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("date_saved");

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

  const sortedEvents = useMemo(() => {
    const list = [...savedEvents];
    if (sortBy === "name") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "start_date") {
      list.sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
    } else {
      list.sort((a, b) => {
        const aDate = savedRecords.find((r) => r.event_id === a.id)?.created_at || 0;
        const bDate = savedRecords.find((r) => r.event_id === b.id)?.created_at || 0;
        return new Date(bDate) - new Date(aDate);
      });
    }
    return list;
  }, [savedEvents, savedRecords, sortBy]);

  if (loading) {
    return <LoadingState text="Loading your saved activities..." />;
  }

  if (savedEvents.length === 0) {
    return (
      <EmptyState
        icon={Bookmark}
        title="No Saved Activities"
        description="Save activities to keep track of them for later."
        actionLabel="Browse Activities"
        onAction={() => navigate("/")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px] rounded-xl h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_saved">Date Saved</SelectItem>
            <SelectItem value="start_date">Start Date</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sortedEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            isSaved
            onToggleSave={handleToggleSave}
          />
        ))}
      </div>
    </div>
  );
}
