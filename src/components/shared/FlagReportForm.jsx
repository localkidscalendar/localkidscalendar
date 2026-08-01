import React, { useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const FLAG_REASONS = [
  { value: "inaccurate", label: "Inaccurate" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

/** Ad creatives: no "Inaccurate" — flags target the Ad Asset, not zip placement details. */
export const AD_FLAG_REASONS = FLAG_REASONS.filter((r) => r.value !== "inaccurate");

/**
 * Modal prompt for community flag reasons (activities, comments, ads).
 * Reason is required. Details are always available; required when reason is Other.
 */
export default function FlagReportForm({
  open = false,
  onOpenChange,
  targetLabel = "item",
  reasons = FLAG_REASONS,
  onSubmit,
  onCancel,
  detailsAlwaysRequired = false,
  title,
  description,
  reasonPrompt,
}) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason(null);
      setDetails("");
      setSubmitting(false);
    }
  }, [open]);

  const detailsRequired = detailsAlwaysRequired || reason === "other";
  const canSubmit = Boolean(reason) && (!detailsRequired || details.trim());

  const handleClose = () => {
    if (submitting) return;
    onOpenChange?.(false);
    onCancel?.();
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        reason,
        details: details.trim() || null,
      });
      onOpenChange?.(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); else onOpenChange?.(true); }}>
      <DialogContent className="sm:max-w-md rounded-2xl p-6">
        <DialogHeader className="text-left space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-peach-50 flex items-center justify-center">
            <Flag className="w-6 h-6 text-peach-500" />
          </div>
          <DialogTitle className="font-heading font-bold text-xl">
            {title || `Report this ${targetLabel}`}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground whitespace-pre-wrap">
            {description || `Tell us why this ${targetLabel} should be reviewed. Your report helps keep LocalKidsCalendar safe for families.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div>
            <p className="text-sm font-medium mb-2">
              {reasonPrompt || `Why are you flagging this ${targetLabel}?`}
            </p>
            <div className="flex flex-wrap gap-2">
              {reasons.map((r) => (
                <Button
                  key={r.value}
                  type="button"
                  variant={reason === r.value ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl text-xs capitalize"
                  onClick={() => setReason(r.value)}
                  disabled={submitting}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>

          {reason && (
            <div>
              <textarea
                placeholder={
                  detailsRequired
                    ? "Please describe the issue… (required)"
                    : "Optional comments…"
                }
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full rounded-xl border border-border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-peach-500 min-h-[72px]"
                rows={3}
                disabled={submitting}
              />
              {detailsRequired && !details.trim() && (
                <p className="text-[11px] text-peach-600 mt-1">
                  {detailsAlwaysRequired
                    ? "A short explanation is required."
                    : "A short explanation is required for Other."}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-peach-500 hover:bg-peach-600 text-white"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Submitting…" : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirm dialog when the user already flagged an item and taps Flag again.
 */
export function FlagWithdrawDialog({
  open = false,
  onOpenChange,
  targetLabel = "item",
  onConfirm,
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const handleClose = () => {
    if (busy) return;
    onOpenChange?.(false);
  };

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm?.();
      onOpenChange?.(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) handleClose(); else onOpenChange?.(true); }}>
      <DialogContent className="sm:max-w-sm rounded-2xl p-6">
        <DialogHeader className="text-left space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-peach-50 flex items-center justify-center">
            <Flag className="w-6 h-6 text-peach-500" />
          </div>
          <DialogTitle className="font-heading font-bold text-xl">
            Already flagged
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            You already flagged this {targetLabel}. Would you like to remove your flag?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={handleClose}
            disabled={busy}
          >
            Keep Flag
          </Button>
          <Button
            type="button"
            className="rounded-xl bg-peach-500 hover:bg-peach-600 text-white"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Removing…" : "Remove Flag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
