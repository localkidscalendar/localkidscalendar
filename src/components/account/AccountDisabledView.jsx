import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { formatPhoneInput } from "@/lib/phone";
import moment from "moment";

export const REACTIVATE_SUBJECT = "Request to Reactivate My Account";

/**
 * Shared disabled-account experience for live users and admin preview.
 * When `preview` is set, no network calls are made.
 */
export default function AccountDisabledView({
  user,
  preview = null,
  onLogout,
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!preview);
  const [disabledNote, setDisabledNote] = useState(preview?.disabledNote || "");
  const [disabledAt, setDisabledAt] = useState(preview?.disabledAt || null);
  const [request, setRequest] = useState(preview?.request || null);
  const [senderName, setSenderName] = useState(preview?.senderName || "");
  const [senderEmail, setSenderEmail] = useState(preview?.senderEmail || "");
  const [senderPhone, setSenderPhone] = useState(preview?.senderPhone || "");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [hpField, setHpField] = useState("");
  const [formLoadTime] = useState(() => Date.now());

  useEffect(() => {
    if (preview) {
      setDisabledNote(preview.disabledNote || "");
      setDisabledAt(preview.disabledAt || null);
      setRequest(preview.request || null);
      setSenderName(preview.senderName || "Preview User");
      setSenderEmail(preview.senderEmail || "preview@example.com");
      setSenderPhone(preview.senderPhone || "");
      setLoading(false);
      return;
    }

    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [{ data: profile }, { data: req }] = await Promise.all([
        supabase
          .from("profiles")
          .select("disabled_note, disabled_at, first_name, last_name, email")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("account_reactivation_requests")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setDisabledNote(profile?.disabled_note || "");
      setDisabledAt(profile?.disabled_at || null);
      setRequest(req || null);
      const name =
        [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
        || user.full_name
        || profile?.first_name
        || "";
      setSenderName(name);
      setSenderEmail(user.email || profile?.email || "");
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id, preview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (preview) {
      toast({ title: "Preview mode — request not submitted" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Please enter a message.", variant: "destructive" });
      return;
    }
    if (!senderName.trim() || !senderEmail.trim()) {
      toast({ title: "Please fill in your name and email.", variant: "destructive" });
      return;
    }
    if (hpField || Date.now() - formLoadTime < 2000) {
      setJustSubmitted(true);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase
      .from("account_reactivation_requests")
      .insert({
        user_id: user.id,
        sender_name: senderName.trim(),
        sender_email: senderEmail.trim(),
        sender_phone: senderPhone.trim() || null,
        message: message.trim(),
        status: "pending",
      })
      .select("*")
      .maybeSingle();
    setSubmitting(false);

    if (error) {
      toast({
        title: "Could not submit request",
        description: error.message.includes("duplicate") || error.code === "23505"
          ? "You have already submitted a reactivation request."
          : error.message,
        variant: "destructive",
      });
      return;
    }

    setRequest(data);
    setJustSubmitted(true);
    toast({ title: "Request submitted" });
  };

  const handleBrowseAsGuest = async () => {
    if (preview) {
      navigate("/");
      return;
    }
    navigate("/");
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showForm = !request && !justSubmitted;
  const showPending = request?.status === "pending" || (justSubmitted && !request?.status);
  const showDeclined = request?.status === "declined";
  const showReactivated = request?.status === "reactivated";

  return (
    <div className="max-w-lg mx-auto px-4 py-10 sm:py-14">
      {preview && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Admin preview — {preview.scenarioLabel || "Disabled account page"}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-red-50 p-2 shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">
              Account Disabled
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your account has been disabled by an administrator.
              {disabledAt
                ? ` (${moment.utc(disabledAt).local().format("MMM D, YYYY h:mm A")})`
                : ""}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">Note from Admin</p>
          <p className="text-sm whitespace-pre-wrap">
            {disabledNote?.trim() || "No additional note was provided."}
          </p>
        </div>

        {showReactivated && (
          <div className="rounded-xl border border-mint-200 bg-mint-50/60 p-4 flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-mint-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-mint-800">Your account has been reactivated</p>
              <p className="text-xs text-mint-700 mt-1">
                Sign out and sign back in if you still see this page.
              </p>
            </div>
          </div>
        )}

        {showDeclined && (
          <div className="space-y-3">
            <div className="rounded-xl border border-peach-200 bg-peach-50/60 p-4">
              <p className="text-sm font-medium text-peach-800 mb-2">Your Reactivation Request</p>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{request.message}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Submitted {moment.utc(request.created_at).local().format("MMM D, YYYY h:mm A")}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
              <p className="text-sm font-medium text-red-800 mb-1">Request Declined</p>
              <p className="text-xs text-muted-foreground mb-2">Reason from Admin</p>
              <p className="text-sm whitespace-pre-wrap">
                {request.admin_note?.trim() || "No additional note was provided."}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              You may only submit one reactivation request. Please continue browsing as a guest, or contact support if you believe this is an error.
            </p>
          </div>
        )}

        {showPending && (
          <div className="rounded-xl border border-mint-200 bg-mint-50/60 p-4 flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-mint-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-mint-800">Request received</p>
              <p className="text-sm text-mint-700 mt-1">
                Please check back here for a response from an administrator. Any decision will appear on this page.
              </p>
              {request?.message && (
                <p className="text-xs text-muted-foreground mt-3 whitespace-pre-wrap border-t border-mint-200/80 pt-3">
                  Your message: {request.message}
                </p>
              )}
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold mb-1">Request to Reactivate My Account</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Submit one request for an administrator to review. You will not be able to submit another request after this.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reactivate-name">Name</Label>
              <Input
                id="reactivate-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reactivate-email">Email</Label>
              <Input
                id="reactivate-email"
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="rounded-xl"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reactivate-phone">Phone (optional)</Label>
              <Input
                id="reactivate-phone"
                value={senderPhone}
                onChange={(e) => setSenderPhone(formatPhoneInput(e.target.value))}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={REACTIVATE_SUBJECT} readOnly className="rounded-xl bg-muted/40" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reactivate-message">Message</Label>
              <Textarea
                id="reactivate-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="rounded-xl"
                placeholder="Please explain why your account should be reactivated…"
                required
              />
            </div>

            {/* honeypot */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={hpField}
              onChange={(e) => setHpField(e.target.value)}
              className="absolute left-[-9999px] opacity-0 h-0 w-0"
              aria-hidden="true"
            />

            <Button
              type="submit"
              className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Request"}
            </Button>
          </form>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl flex-1"
            onClick={handleBrowseAsGuest}
          >
            Continue as Guest
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="rounded-xl flex-1"
            onClick={() => {
              if (preview) {
                toast({ title: "Preview mode — Sign Out not available" });
                return;
              }
              if (onLogout) onLogout(true);
              else navigate("/login");
            }}
          >
            Sign Out
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Questions about site expectations? See{" "}
          <Link to="/about#community-rules" className="underline underline-offset-2 hover:text-foreground">
            Our Community Rules
          </Link>
          {", "}
          <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          {", and "}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
