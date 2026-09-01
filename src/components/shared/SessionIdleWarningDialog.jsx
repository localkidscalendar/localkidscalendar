import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SESSION_IDLE_WARNING_MS } from "../../../shared/sessionActivityPolicy.js";

const WARNING_MINUTES = Math.round(SESSION_IDLE_WARNING_MS / 60000);

export default function SessionIdleWarningDialog({ open, onStaySignedIn, onSignOut }) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onStaySignedIn?.()}>
      <DialogContent className="sm:max-w-md" onPointerDown={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            You&apos;ve been inactive. For your security, you&apos;ll be signed out in about{" "}
            {WARNING_MINUTES} minute{WARNING_MINUTES === 1 ? "" : "s"} unless you stay signed in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" className="rounded-xl" onClick={onSignOut}>
            Sign out now
          </Button>
          <Button className="rounded-xl bg-mint-500 hover:bg-mint-600 text-white" onClick={onStaySignedIn}>
            Stay signed in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
