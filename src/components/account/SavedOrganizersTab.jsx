import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import OrganizerCard from "@/components/organizers/OrganizerCard";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { Input } from "@/components/ui/input";
import { Heart } from "lucide-react";

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

  const filteredOrganizers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizers;
    return organizers.filter((org) => {
      const hay = [
        org.name,
        org.organization_name,
        org.city,
        org.state,
        org.zip_code,
        org.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [organizers, search]);

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

      <Input
        placeholder="Search favorite organizers…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="rounded-xl h-9 text-sm sm:max-w-xs"
      />

      {filteredOrganizers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No organizers match your search.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredOrganizers.map((org) => (
            <OrganizerCard
              key={org.id}
              org={org}
              isFavorite
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>
      )}
    </div>
  );
}
