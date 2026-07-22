import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import OrganizerCard from "@/components/organizers/OrganizerCard";
import { Heart, Search } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Input } from "@/components/ui/input";

export default function SavedOrganizersTab({ user }) {
  const navigate = useNavigate();
  const [organizers, setOrganizers] = useState([]);
  const [favoriteRecords, setFavoriteRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const records = await base44.entities.FavoriteOrganizer.list();
      setFavoriteRecords(records);
      const orgIds = records.map((r) => r.organizer_id);
      if (orgIds.length > 0) {
        const allOrganizers = await base44.entities.Organizer.list("org_name", 200);
        setOrganizers(allOrganizers.filter((o) => orgIds.includes(o.id)));
      } else {
        setOrganizers([]);
      }
    } catch {}
    setLoading(false);
  };

  const toggleFavorite = async (orgId) => {
    const record = favoriteRecords.find((r) => r.organizer_id === orgId);
    if (record) {
      await base44.entities.FavoriteOrganizer.delete(record.id);
      setFavoriteRecords((prev) => prev.filter((r) => r.organizer_id !== orgId));
      setOrganizers((prev) => prev.filter((o) => o.id !== orgId));
      try {
        const prefs = await base44.entities.NotificationPreference.filter({}, "-created_date", 1);
        if (prefs.length > 0) {
          const pref = prefs[0];
          const updated = (pref.organizer_ids || []).filter((id) => id !== orgId);
          await base44.entities.NotificationPreference.update(pref.id, { organizer_ids: updated });
        }
      } catch {}
    }
  };

  if (loading) {
    return <LoadingState text="Loading your saved organizers..." />;
  }

  if (organizers.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No Saved Organizers"
        description="Favorite organizers to keep track of them and get notified about their activities."
        actionLabel="Browse Organizers"
        onAction={() => navigate("/organizers")}
      />
    );
  }

  const filtered = organizers.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (o.org_name || "").toLowerCase().includes(q) || (o.org_description || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search organizers..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 rounded-xl w-full" />
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No organizers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((org) => (
            <OrganizerCard key={org.id} org={org} isFavorite={true} onToggleFavorite={toggleFavorite} />
          ))}
        </div>
      )}
    </div>
  );
}