import React from "react";
import EmptyState from "@/components/shared/EmptyState";
import { ShieldAlert } from "lucide-react";

export default function FlaggedContentTab() {
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Flagged content coming soon"
      description="This account tab will return in a later Supabase migration step."
    />
  );
}
