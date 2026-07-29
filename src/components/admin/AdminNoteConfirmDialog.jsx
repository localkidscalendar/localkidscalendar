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
 * Confirm disable / decline with a required note shown to the user.
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
  confirmVariant = "destructive",
  loading = false,
  onConfirm,
}) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const handleOpenChange = (next) => {
    if (!next) {
      setNote("");
      setTouched(false);
    }
    onOpenChange?.(next);
  };

  const trimmed = note.trim();
  const canSubmit = !noteRequired || trimmed.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2 py-1">
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
              await onConfirm?.(trimmed);
              setNote("");
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
