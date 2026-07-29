import React, { useState } from "react";
import { Button } from "@/components/ui/button";

export const FLAG_REASONS = [
  { value: "inaccurate", label: "Inaccurate" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

/**
 * Shared flag UI for activities, comments, and ads.
 * Reason is required. Comments are always available; required when reason is Other.
 */
export default function FlagReportForm({
  targetLabel = "item",
  onSubmit,
  onCancel,
  compact = false,
}) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const detailsRequired = reason === "other";
  const canSubmit = Boolean(reason) && (!detailsRequired || details.trim());

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        reason,
        details: details.trim() || null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const textSize = compact ? "text-xs" : "text-sm";
  const btnClass = compact ? "rounded-lg text-xs h-7" : "rounded-xl text-xs";
  const reasonBtnClass = compact
    ? "rounded-lg text-xs h-7 capitalize"
    : "rounded-xl text-xs capitalize";

  return (
    <div className={`bg-peach-50 rounded-xl ${compact ? "p-3" : "p-4"} animate-settle`}>
      <p className={`${textSize} font-medium mb-2`}>
        Why are you flagging this {targetLabel}?
      </p>
      <div className={`flex flex-wrap gap-2 ${compact ? "mb-2" : "mb-3"}`}>
        {FLAG_REASONS.map((r) => (
          <Button
            key={r.value}
            type="button"
            variant={reason === r.value ? "default" : "outline"}
            size="sm"
            className={reasonBtnClass}
            onClick={() => setReason(r.value)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {reason && (
        <div className={compact ? "mb-2" : "mb-3"}>
          <textarea
            placeholder={
              detailsRequired
                ? "Please describe the issue… (required)"
                : "Optional comments…"
            }
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            className={`w-full rounded-lg border border-peach-200 p-2 ${textSize} focus:outline-none focus:ring-2 focus:ring-peach-500`}
            rows={2}
          />
          {detailsRequired && !details.trim() && (
            <p className="text-[11px] text-peach-600 mt-1">A short explanation is required for Other.</p>
          )}
        </div>
      )}

      {reason && (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            className={btnClass}
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Submitting…" : compact ? "Submit" : "Submit Report"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={btnClass}
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
