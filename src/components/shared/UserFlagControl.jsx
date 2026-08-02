import React, { useCallback, useEffect, useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import FlagReportForm, { FlagWithdrawDialog } from "@/components/shared/FlagReportForm";
import {
  alreadyFlaggedMessage,
  submitUserFlag,
  userHasFlaggedTarget,
  withdrawUserFlag,
} from "@/lib/flagReports";
import { toast } from "@/components/ui/use-toast";

export const USER_FLAG_REASONS = [
  { value: "misrepresented_user", label: "Misrepresented User" },
  { value: "disregard_rules", label: "Disregard for Our Community Rules" },
  { value: "other", label: "Other" },
];

const USER_FLAG_INTRO =
  "You're reporting this community member / organizer, not this activity. If the problem is a specific listing, comment, or ad, use Flag on that item instead. Only flag a person for issues like impersonation or repeated disregard for community rules.";

/**
 * Flag a user profile (Posted by / Organizer card).
 * variant: "icon" | "button"
 */
export default function UserFlagControl({
  targetUserId,
  currentUserId,
  label = "user",
  variant = "icon",
  className = "",
}) {
  const [alreadyFlagged, setAlreadyFlagged] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentUserId || !targetUserId) {
      setAlreadyFlagged(false);
      return;
    }
    setChecking(true);
    try {
      setAlreadyFlagged(await userHasFlaggedTarget("user", targetUserId, currentUserId));
    } catch {
      setAlreadyFlagged(false);
    } finally {
      setChecking(false);
    }
  }, [currentUserId, targetUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!targetUserId || !currentUserId || targetUserId === currentUserId) {
    return null;
  }

  const handleClick = async () => {
    if (checking) return;
    if (alreadyFlagged) {
      setWithdrawOpen(true);
      return;
    }
    setFormOpen(true);
  };

  const handleSubmit = async ({ reason, details }) => {
    const { data, error } = await submitUserFlag(targetUserId, reason, details);
    if (error) {
      const msg = error.message || "";
      if (/already flagged/i.test(msg)) {
        toast({ title: alreadyFlaggedMessage(label), variant: "destructive" });
        setAlreadyFlagged(true);
        return;
      }
      toast({ title: "Could not submit flag", description: msg, variant: "destructive" });
      throw error;
    }
    setAlreadyFlagged(true);
    toast({
      title: data?.suspended ? "Report submitted — account suspended for review" : "Report submitted",
      description: "Thank you for helping keep the community safe.",
    });
  };

  const handleWithdraw = async () => {
    const { data, error } = await withdrawUserFlag(targetUserId);
    if (error) {
      toast({ title: "Could not remove flag", description: error.message, variant: "destructive" });
      throw error;
    }
    setAlreadyFlagged(false);
    toast({
      title: "Flag removed",
      description: data?.restored ? "Their account is no longer suspended." : undefined,
    });
  };

  return (
    <>
      {variant === "button" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={`rounded-xl text-xs h-8 gap-1.5 ${alreadyFlagged ? "border-peach-300 text-peach-600 bg-peach-50" : "text-muted-foreground"} ${className}`}
          onClick={handleClick}
          disabled={checking}
          title={alreadyFlagged ? "You flagged this user" : "Flag this user"}
        >
          <Flag className={`w-3.5 h-3.5 ${alreadyFlagged ? "fill-peach-500 text-peach-500" : ""}`} />
          {alreadyFlagged ? "Flagged" : "Flag"}
        </Button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={checking}
          title={alreadyFlagged ? "You flagged this user" : "Flag this user"}
          className={`shrink-0 p-1.5 rounded-md text-muted-foreground/70 hover:text-muted-foreground transition-colors ${className}`}
        >
          <Flag className={`w-4 h-4 ${alreadyFlagged ? "fill-muted-foreground/40 text-muted-foreground" : ""}`} />
        </button>
      )}

      <FlagReportForm
        open={formOpen}
        onOpenChange={setFormOpen}
        targetLabel={label}
        reasons={USER_FLAG_REASONS}
        detailsAlwaysRequired
        title="Report this user"
        description={USER_FLAG_INTRO}
        reasonPrompt="Why are you flagging this user?"
        onSubmit={handleSubmit}
      />
      <FlagWithdrawDialog
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        targetLabel={label}
        onConfirm={handleWithdraw}
      />
    </>
  );
}
