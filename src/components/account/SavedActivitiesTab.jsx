import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
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
      const saves = await base44.entities.SavedEvent.filter({}, "-created_date", 100);
      setSavedRecords(saves);
      const savedIds = saves.map((s) => s.event_id);
      if (savedIds.length > 0) {
        const allEvents = await base44.entities.Event.filter({ status: "active" }, "-created_date", 200);
        setSavedEvents(allEvents.filter((e) => savedIds.includes(e.id)));
      } else {
        setSavedEvents([]);
      }
    } catch {}
    setLoading(false);
  };

  const handleToggleSave = async (eventId) => {
    const record = savedRecords.find((r) => r.event_id === eventId);
    if (record) {
      const event = savedEvents.find((e) => e.id === eventId);
      await base44.entities.SavedEvent.delete(record.id);
      if (event) await base44.entities.Event.update(eventId, { save_count: Math.max(0, (event.save_count || 0) - 1) });
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
        const aDate = savedRecords.find((r) => r.event_id === a.id)?.created_date || 0;
        const bDate = savedRecords.find((r) => r.event_id === b.id)?.created_date || 0;
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
    <div>
      <div className="flex items-center gap-2 mb-4">
        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[200px] rounded-xl">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date_saved">Date Saved</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="start_date">Activity Start Date</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedEvents.map((e) => <EventCard key={e.id} event={e} isSaved={true} onToggleSave={handleToggleSave} />)}
      </div>
    </div>
  );
}