import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Shared Admin confirm dialog with optional/required note and email delivery mode.
 *
 * emailMode:
 * - "optional" — checkbox, default off (e.g. disable user)
 * - "always" — no checkbox; copy says inbox + email (e.g. disable ad)
 * - "never" — no checkbox; copy says inbox only (e.g. remove activity)
 */
export default function AdminNoteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  noteLabel = "Note to User",
  notePlaceholder = "Explain why…",
  noteRequired = true,
  emailMode = "never",
  deliveryHint = null,
  confirmVariant = "destructive",
  loading = false,
  onConfirm,
}) {
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [touched, setTouched] = useState(false);

  const handleOpenChange = (next) => {
    if (!next) {
      setNote("");
      setSendEmail(false);
      setTouched(false);
    }
    onOpenChange?.(next);
  };

  const trimmed = note.trim();
  const canSubmit = !noteRequired || trimmed.length > 0;

  const resolvedHint =
    deliveryHint ||
    (emailMode === "always"
      ? "They will receive an inbox Message and an email."
      : emailMode === "never"
        ? "They will receive an inbox Message only (no email)."
        : null);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-2">
            <Label htmlFor="admin-note-field">
              {noteLabel}
              {noteRequired ? " *" : " (optional)"}
            </Label>
            <Textarea
              id="admin-note-field"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={4}
              className="rounded-xl"
              placeholder={notePlaceholder}
            />
            {touched && noteRequired && !trimmed && (
              <p className="text-xs text-destructive">A note is required.</p>
            )}
          </div>

          {emailMode === "optional" ? (
            <label className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 rounded border-border"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                disabled={loading}
              />
              <span>
                Also send an email with this note
                <span className="block text-xs mt-0.5">
                  They always see the note on the Account Disabled page. Email is optional for grey-area cases.
                </span>
              </span>
            </label>
          ) : resolvedHint ? (
            <p className="text-xs text-muted-foreground">{resolvedHint}</p>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={loading}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant === "destructive" ? "destructive" : "default"}
            className={`rounded-xl ${
              confirmVariant === "mint" ? "bg-mint-500 hover:bg-mint-600 text-white" : ""
            }`}
            disabled={loading || !canSubmit}
            onClick={async () => {
              setTouched(true);
              if (!canSubmit) return;
              const shouldEmail = emailMode === "always" ? true : emailMode === "optional" ? sendEmail : false;
              await onConfirm?.(trimmed, { sendEmail: shouldEmail });
              setNote("");
              setSendEmail(false);
              setTouched(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
