import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Standardized loading state component used across the app.
 * Shows a centered spinner with optional text.
 */
export default function LoadingState({ text = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      {text && <span className="ml-3 text-sm text-muted-foreground">{text}</span>}
    </div>
  );
}