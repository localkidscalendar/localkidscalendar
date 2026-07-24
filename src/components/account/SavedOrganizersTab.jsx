import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import OrganizerCard from "@/components/organizers/OrganizerCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Heart } from "lucide-react";

export default function SavedOrganizersTab({ user }) {
  const navigate = useNavigate();
  const [organizers, setOrganizers] = useState([]);
  const [favoriteRecords, setFavoriteRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: records, error } = await supabase
        .from("favorite_organizers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFavoriteRecords(records || []);

      const organizerIds = (records || []).map((r) => r.organizer_id).filter(Boolean);
      if (organizerIds.length === 0) {
        setOrganizers([]);
      } else {
        const { data: orgs, error: orgError } = await supabase
          .from("organizers")
          .select("*")
          .in("id", organizerIds);
        if (orgError) throw orgError;
        setOrganizers(orgs || []);
      }
    } catch {
      setFavoriteRecords([]);
      setOrganizers([]);
    }
    setLoading(false);
  };

  const toggleFavorite = async (orgId) => {
    const record = favoriteRecords.find((r) => r.organizer_id === orgId);
    if (!record) return;
    await supabase.from("favorite_organizers").delete().eq("id", record.id);
    setFavoriteRecords((prev) => prev.filter((r) => r.organizer_id !== orgId));
    setOrganizers((prev) => prev.filter((o) => o.id !== orgId));
  };

  if (loading) {
    return <LoadingState text="Loading favorite organizers..." />;
  }

  if (organizers.length === 0) {
    return (
      <EmptyState
        icon={Heart}
        title="No Favorite Organizers"
        description="Favorite organizers from the Organizers page to see them here."
        actionLabel="Browse Organizers"
        onAction={() => navigate("/organizers")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Organizers you&apos;ve favorited so you can follow their activities more easily.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {organizers.map((org) => (
          <OrganizerCard
            key={org.id}
            org={org}
            isFavorite
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}
