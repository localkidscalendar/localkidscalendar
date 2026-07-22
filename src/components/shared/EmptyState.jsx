import React from "react";
import { Button } from "@/components/ui/button";

/**
 * Reusable empty state component for consistent "no data" messaging across the app.
 * @param {React.ComponentType} icon - Lucide icon component
 * @param {string} title - Main heading
 * @param {string} description - Supporting text
 * @param {string} actionLabel - Button text (optional)
 * @param {() => void} onAction - Button click handler (optional)
 */
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  if (!Icon) return null;
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-mint-50 flex items-center justify-center mx-auto mb-4">
        <Icon className="w-8 h-8 text-mint-300" />
      </div>
      <h3 className="font-heading font-semibold text-lg mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}