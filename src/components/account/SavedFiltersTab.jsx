import React from "react";
import EmptyState from "@/components/shared/EmptyState";
import { UserCog } from "lucide-react";

export default function SavedFiltersTab() {
  return (
    <EmptyState
      icon={UserCog}
      title="Saved filters coming soon"
      description="This account tab will return in a later Supabase migration step."
    />
  );
}
