import React from "react";
import EmptyState from "@/components/shared/EmptyState";
import { Heart } from "lucide-react";

export default function SavedOrganizersTab() {
  return (
    <EmptyState
      icon={Heart}
      title="Favorite organizers coming soon"
      description="This account tab will return in a later Supabase migration step."
    />
  );
}
