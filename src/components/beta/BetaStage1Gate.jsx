// BETA MODE — temporary access gate (Stage 1) with public preview info.
import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, KeyRound, Mail } from "lucide-react";
import { formatPhoneInput } from "@/lib/phone";
import TurnstileWidget from "@/components/shared/TurnstileWidget";
import { getBetaStage1Access, setBetaStage1Access } from "@/lib/betaStage1Access";
import {
  CONTACT_HONEYPOT_FIELD,
  CONTACT_MIN_SUBMIT_MS,
} from "../../../shared/contactFormConstants.js";

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();
const PREVIEW_CONTACT_SUBJECT = "General Questions";

function PreviewContactForm() {
  const turnstileRef = useRef(null);
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [message, setMessage] = useState("");
  const [hpField, setHpField] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [formLoadTime] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!senderName.trim() || !senderEmail.trim() || !senderPhone.trim() || !message.trim()) {
      setFormError("Please fill in all required fields.");
      return;
    }
    if (hpField || Date.now() - formLoadTime < CONTACT_MIN_SUBMIT_MS) {
      setSubmitted(true);
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setFormError("Security check is still loading. Try again in a second.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiUrl("/api/contact-submit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_name: senderName.trim(),
          sender_email: senderEmail.trim(),
          sender_phone: senderPhone.trim(),
          subject: PREVIEW_CONTACT_SUBJECT,
          message: message.trim(),
          [CONTACT_HONEYPOT_FIELD]: hpField,
          form_loaded_at: formLoadTime,
          turnstile_token: turnstileToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not send message.");
      }
      setSubmitted(true);
    } catch (err) {
      turnstileRef.current?.reset();
      setTurnstileToken("");
      setFormError(err.message || "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="text-center py-6 space-y-2">
        <CheckCircle2 className="w-10 h-10 text-mint-500 mx-auto" />
        <p className="font-heading font-semibold text-lg">Message sent</p>
        <p className="text-sm text-muted-foreground">
          Thanks for reaching out. We&apos;ll get back to you as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="beta-preview-website">Website</label>
        <input
          id="beta-preview-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hpField}
          onChange={(e) => setHpField(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">Name *</Label>
          <Input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="rounded-xl mt-1"
            placeholder="Your name"
            autoComplete="name"
          />
        </div>
        <div>
          <Label className="text-sm">Email *</Label>
          <Input
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            className="rounded-xl mt-1"
            placeholder="your@email.com"
            type="email"
            autoComplete="email"
          />
        </div>
      </div>

      <div>
        <Label className="text-sm">Phone *</Label>
        <Input
          value={senderPhone}
          onChange={(e) => setSenderPhone(formatPhoneInput(e.target.value))}
          className="rounded-xl mt-1"
          placeholder="(555) 123-4567"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={14}
        />
      </div>

      <div>
        <Label className="text-sm">Subject</Label>
        <Input value={PREVIEW_CONTACT_SUBJECT} readOnly className="rounded-xl mt-1 bg-muted/40" />
      </div>

      <div>
        <Label className="text-sm">Message *</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-xl mt-1 min-h-[120px]"
          placeholder="Write your message here..."
        />
      </div>

      <TurnstileWidget
        ref={turnstileRef}
        siteKey={TURNSTILE_SITE_KEY}
        action="contact"
        onToken={setTurnstileToken}
        onError={() => setTurnstileToken("")}
        className="flex justify-center min-h-[65px]"
      />

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <Button
        type="submit"
        className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white"
        disabled={submitting || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
      >
        {submitting ? "Sending..." : "Send Message"}
      </Button>
    </form>
  );
}

export default function BetaStage1Gate({ children }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("beta_config")
          .select("stage1_enabled, access_code")
          .eq("config_key", "global")
          .maybeSingle();
        if (fetchError) throw fetchError;
        if (!cancelled) setConfig(data || null);
      } catch {
        if (!cancelled) setConfig(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    const stored = getBetaStage1Access();
    if (stored && config.access_code && stored === config.access_code) {
      setVerified(true);
    }
  }, [config]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-mint-100 border-t-mint-500 rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-heading">Loading...</p>
        </div>
      </div>
    );
  }
  if (!config?.stage1_enabled || !config?.access_code) return children;
  if (verified) return children;

  const handleAccessSubmit = (e) => {
    e.preventDefault();
    if (input.trim() === config.access_code) {
      setBetaStage1Access(input.trim());
      setVerified(true);
      setError("");
    } else {
      setError("Incorrect access code.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-mint-50/80 via-background to-peach-50/40">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14 space-y-8">
        <header className="text-center space-y-3">
          <img
            src="/logo.png"
            alt="LocalKidsCalendar"
            className="mx-auto h-16 w-16 object-contain sm:h-20 sm:w-20"
          />
          <h1 className="font-heading font-bold text-2xl sm:text-3xl text-foreground">
            LocalKidsCalendar.com
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
            We&apos;re completing the final touches before launching the site to test markets.
            Thanks for your patience — you can learn more below, send us a message, or enter an
            access code if you have one.
          </p>
        </header>

        <section className="bg-white rounded-2xl border border-border p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-mint-500 shrink-0" />
            <h2 className="font-heading font-semibold text-lg">Have an access code?</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Private preview access is limited while we finish launch prep. Enter your code to continue
            to the site.
          </p>
          <form onSubmit={handleAccessSubmit} className="space-y-3">
            <Input
              type="text"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Access code"
              className="rounded-xl"
              autoComplete="off"
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full rounded-xl bg-mint-500 hover:bg-mint-600 text-white">
              Enter site
            </Button>
          </form>
        </section>

        <section className="bg-white rounded-2xl border border-border p-5 sm:p-6 space-y-4">
          <h2 className="font-heading font-bold text-xl text-foreground">
            About LocalKidsCalendar.com
          </h2>
          <div className="text-sm text-muted-foreground space-y-4 leading-relaxed">
            <p>
              LocalKidsCalendar.com is a free, community-powered hub, built by parents, for parents.
              We believe that every child deserves access to enriching local experiences — from summer
              camps and after-school classes to sports leagues and weekend events — and that finding
              those opportunities should be easy, fast, and free.
            </p>

            <aside
              className="flex overflow-hidden rounded-2xl border border-orange-500 bg-gradient-to-br from-peach-50 to-mint-50"
              aria-label="What LocalKidsCalendar is"
            >
              <div className="-my-px -ml-px flex w-[4.5rem] shrink-0 items-center justify-center self-stretch overflow-hidden rounded-2xl border border-orange-500 bg-white sm:w-[5.25rem]">
                <img
                  src="/logo.png"
                  alt="LocalKidsCalendar logo"
                  className="h-[4.5rem] w-[4.5rem] object-contain sm:h-[5.25rem] sm:w-[5.25rem]"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3 py-3 sm:px-6 sm:py-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mint-600">
                  In a nutshell
                </p>
                <p className="font-heading text-sm font-semibold leading-snug text-foreground sm:text-base">
                  It&apos;s a community-driven resource for parents to find local activities for their
                  kids.
                </p>
              </div>
            </aside>

            <p>
              Our platform brings together local families and activity organizers in one central place.
              Whether you&apos;re a parent searching for the perfect soccer camp or a dance studio
              looking to reach more local families, LocalKidsCalendar.com is your community&apos;s home
              base.
            </p>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-border p-5 sm:p-6 space-y-4 relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-mint-100 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-mint-500" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-xl">Contact Us</h2>
              <p className="text-sm text-muted-foreground">We&apos;d love to hear from you</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Questions about the launch or LocalKidsCalendar.com? Send a message below. All fields
            marked with * are required.
          </p>
          <PreviewContactForm />
        </section>

        <p className="text-center text-xs text-muted-foreground pb-4">
          © {new Date().getFullYear()} LocalKidsCalendar.com
        </p>
      </div>
    </div>
  );
}
