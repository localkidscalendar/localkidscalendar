import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Building2, Users, LogIn, UserPlus } from "lucide-react";

// Steps: "check_auth" | "login_or_register" | "member_warning" | "granting"
export default function BecomeASupporterModal({ open, onClose, user, onAuthNeeded }) {
  const navigate = useNavigate();
  const [step, setStep] = useState("init");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Determine step on open
  React.useEffect(() => {
    if (!open) { setStep("init"); setError(""); return; }
    if (!user) {
      setStep("login_or_register");
    } else if (user.is_advertiser) {
      // Already an advertiser — send straight to Ad Manager
      navigate("/ad-manager");
      onClose();
    } else if (user.role === "community_member") {
      setStep("member_warning");
    } else {
      // Organizer (or admin) — grant and proceed
      grantAndProceed();
    }
  }, [open, user]);

  const grantAndProceed = () => {
    // Advertiser status is granted only after a verified Stripe payment (or by an
    // admin) — Ad Manager itself is open to any logged-in user to start that flow.
    setStep("granting");
    window.location.href = "/ad-manager";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-xl">Become a Supporter</DialogTitle>
        </DialogHeader>

        {/* Not logged in */}
        {step === "login_or_register" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              To become a Supporter, you'll need an account. Do you already have one?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="rounded-xl h-12 flex-col gap-1 text-sm" onClick={() => { onClose(); navigate("/login?next=/supporters"); }}>
                <LogIn className="w-4 h-4" />
                Log In
              </Button>
              <Button className="rounded-xl h-12 flex-col gap-1 text-sm bg-mint-500 hover:bg-mint-600 text-white" onClick={() => { onClose(); navigate("/register?supporter=true"); }}>
                <UserPlus className="w-4 h-4" />
                Create Account
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              We recommend creating an <strong>Organizer</strong> account — it gives you access to event posting tools in addition to Supporter advertising.
            </p>
          </div>
        )}

        {/* Community Member warning */}
        {step === "member_warning" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 leading-relaxed">
                You're currently registered as a <strong>Community Member</strong>. Supporters often benefit from an Organizer account, which also unlocks event posting tools. Since account types are permanent, you may want to create a separate Organizer account for your business.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">How would you like to proceed?</p>
            <div className="space-y-2">
              <button
                onClick={grantAndProceed}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-border hover:border-mint-300 bg-white text-left transition-colors"
              >
                <Users className="w-5 h-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Continue with my Member account</p>
                  <p className="text-xs text-muted-foreground">Add Supporter access to my current account</p>
                </div>
              </button>
              <button
                onClick={() => { onClose(); navigate("/register?supporter=true&force_organizer=true"); }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-border hover:border-mint-300 bg-white text-left transition-colors"
              >
                <Building2 className="w-5 h-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Create a new Organizer account</p>
                  <p className="text-xs text-muted-foreground">Use a different email address for your business</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Granting / loading */}
        {step === "granting" && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Setting up your Supporter account…
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}