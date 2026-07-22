import React from "react";
import EmptyState from "@/components/shared/EmptyState";
import { Bell } from "lucide-react";

export default function NotificationsTab() {
  return (
    <EmptyState
      icon={Bell}
      title="Notifications coming soon"
      description="This account tab will return in a later Supabase migration step."
    />
  );
}
