import React, { useState, useEffect } from "react";
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
 *
 * restoreOptions: optional [{ id, label, hint?, defaultChecked? }] — extra checkboxes
 * passed to onConfirm as { restore: { [id]: boolean } }.
 */
export default function AdminNoteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  impactDetails = null,
  confirmLabel = "Confirm",
  noteLabel = "Note to User",
  notePlaceholder = "Explain why…",
  noteRequired = true,
  emailMode = "never",
  deliveryHint = null,
  restoreOptions = null,
  restoreOptionsTitle = "Also restore",
  confirmVariant = "destructive",
  loading = false,
  onConfirm,
}) {
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [touched, setTouched] = useState(false);
  const [restore, setRestore] = useState({});

  useEffect(() => {
    if (!open) return;
    setNote("");
    setSendEmail(false);
    setTouched(false);
    const init = {};
    for (const opt of restoreOptions || []) init[opt.id] = Boolean(opt.defaultChecked);
    setRestore(init);
  }, [open, restoreOptions]);

  const handleOpenChange = (next) => {
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
          {impactDetails ? (
            <div className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
              {impactDetails}
            </div>
          ) : null}
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

          {Array.isArray(restoreOptions) && restoreOptions.length > 0 && (
            <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="text-xs font-medium text-foreground/80">{restoreOptionsTitle}</p>
              {restoreOptions.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-start gap-2 text-sm text-muted-foreground cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-border"
                    checked={Boolean(restore[opt.id])}
                    onChange={(e) =>
                      setRestore((prev) => ({ ...prev, [opt.id]: e.target.checked }))
                    }
                    disabled={loading}
                  />
                  <span>
                    {opt.label}
                    {opt.hint ? (
                      <span className="block text-xs mt-0.5">{opt.hint}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          )}

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
              await onConfirm?.(trimmed, { sendEmail: shouldEmail, restore: { ...restore } });
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
