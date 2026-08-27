import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import GoogleIcon from "@/components/GoogleIcon";
import TurnstileWidget from "@/components/shared/TurnstileWidget";
import { Mail, Lock, Loader2, Users, Building2, MapPin, CheckCircle, AlertTriangle } from "lucide-react";
import { DEFAULT_RADIUS_MILES, normalizeRadiusMiles } from "@/lib/locationDefaults";
import { toStrictTitleCase, formatActivityTitle } from "@/lib/titleCase";
import useBetaConfig, { isZipAllowed, betaZipsForDisplay } from "@/lib/useBetaConfig"; // BETA MODE
import { useAuth } from "@/lib/AuthContext";
import { isProfileComplete } from "@/lib/authRoles";
import { assertTurnstilePassed } from "@/lib/verifyTurnstileClient";
import {
  REGISTER_MIN_SUBMIT_MS,
  TURNSTILE_ACTION_REGISTER,
  TURNSTILE_HONEYPOT_FIELD,
} from "../../shared/turnstileFormConstants.js";
import { validateRequiredPublicWebsite } from "../../shared/linkUrlSafety.js";

const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

function BetaZipOutsideNote({ betaConfig, zipCode }) {
  const zips = Array.isArray(betaConfig?.zip_codes) ? betaConfig.zip_codes : [];
  const zip = String(zipCode || "").trim();
  if (!betaConfig?.enabled || zips.length === 0 || zip.length !== 5) return null;
  if (isZipAllowed(zip, betaConfig)) return null;
  const list = betaZipsForDisplay(zips).join(", ");
  if (!list) return null;
  return (
    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed col-span-2">
      We are currently in limited areas (beta). Your zip isn’t in our beta test markets
      {" "}(<span className="font-semibold">{list}</span>).
      You can still join, but you’ll need to adjust the zip code filters on the homepage to see activities.
    </p>
  );
}

function namesFromMetadata(meta = {}) {
  const full = (meta.full_name || meta.name || "").trim();
  const first = (meta.first_name || meta.given_name || (full ? full.split(/\s+/)[0] : "") || "").trim();
  const last = (
    meta.last_name
    || meta.family_name
    || (full.includes(" ") ? full.split(/\s+/).slice(1).join(" ") : "")
    || ""
  ).trim();
  return { first, last };
}

// Step indicator
function StepBar({ step, completeOnly }) {
  const steps = completeOnly ? ["Profile"] : ["Account", "Profile", "Verify"];
  const displayStep = completeOnly ? 1 : step;
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = displayStep > idx;
        const active = displayStep === idx;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                ${done ? "bg-mint-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {done ? <CheckCircle className="w-4 h-4" /> : idx}
              </div>
              <span className={`text-xs mt-1 font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-12 mb-5 mx-1 transition-colors ${displayStep > idx ? "bg-mint-500" : "bg-border"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Register() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, setUser, isLoadingAuth, authChecked, logout, checkUserAuth } = useAuth();
  const betaConfig = useBetaConfig(); // BETA MODE
  const completingOAuth = searchParams.get("complete") === "1";

  const [step, setStep] = useState(completingOAuth ? 2 : 1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(!completingOAuth);

  // Step 1 — credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToRules, setAgreedToRules] = useState(false);

  // Step 2 — profile
  const [role, setRole] = useState("community_member");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [orgEmail, setOrgEmail] = useState("");

  // Bot protection: honeypot + timing + Turnstile (email signup only; verified server-side before signUp)
  const turnstileRef = useRef(null);
  const [hpField, setHpField] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [formLoadTime] = useState(() => Date.now());

  // Admin invite links: /register?role=organizer&email=...
  useEffect(() => {
    const invitedRole = searchParams.get("role");
    const invitedEmail = searchParams.get("email");
    if (invitedRole === "organizer" || invitedRole === "community_member") {
      setRole(invitedRole);
    }
    if (invitedEmail) {
      setEmail(invitedEmail);
      setOrgEmail(invitedEmail);
    }
  }, [searchParams]);

  // Route signed-in users: finished → home; unfinished → profile step
  useEffect(() => {
    if (!authChecked || isLoadingAuth) return;

    if (user && isProfileComplete(user)) {
      navigate("/", { replace: true });
      return;
    }

    if (user && !isProfileComplete(user)) {
      setStep(2);
      setReady(true);
      (async () => {
        setEmail(user.email || "");
        setOrgEmail((prev) => prev || user.email || "");
        try {
          const { data: authData } = await supabase.auth.getUser();
          const meta = authData?.user?.user_metadata || {};
          const names = namesFromMetadata(meta);
          if (names.first) setFirstName((prev) => prev || toStrictTitleCase(names.first));
          if (names.last) setLastName((prev) => prev || toStrictTitleCase(names.last));
          if (meta.org_name) setOrgName((prev) => prev || formatActivityTitle(meta.org_name));
        } catch {}
      })();
      return;
    }

    // Not signed in but hit ?complete=1 — send to login / normal register
    if (completingOAuth && !user) {
      navigate("/register", { replace: true });
      setStep(1);
    }
    setReady(true);
  }, [authChecked, isLoadingAuth, user, completingOAuth, navigate]);

  const handleGoogle = async () => {
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Force Google's account picker so Chrome doesn't silently reuse the last account.
        queryParams: { prompt: "select_account" },
      },
    });
    if (oauthError) {
      setError(
        oauthError.message ||
          "Google sign-in is not configured yet in Supabase Auth providers."
      );
    }
  };

  // Step 1 submit
  const handleStep1 = (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (!agreedToRules) return setError("You must agree to the Terms of Service, Privacy Policy, and Community Rules to continue.");
    setStep(2);
  };

  const finalizeProfile = async (authUser) => {
    const isOrganizer = role === "organizer";
    const nextFirst = isOrganizer ? "" : toStrictTitleCase(firstName.trim());
    const nextLast = isOrganizer ? "" : toStrictTitleCase(lastName.trim());
    const nextOrgName = isOrganizer ? formatActivityTitle(orgName.trim()) : null;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authUser.id,
      email: authUser.email,
      role,
      first_name: nextFirst,
      last_name: nextLast,
      zip_code: zipCode.trim(),
      radius_miles: normalizeRadiusMiles(DEFAULT_RADIUS_MILES),
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    if (isOrganizer) {
      const websiteCheck = validateRequiredPublicWebsite(orgWebsite);
      if (!websiteCheck.ok) throw new Error(websiteCheck.reason);
      const { error: orgError } = await supabase.from("organizers").upsert({
        user_id: authUser.id,
        org_name: nextOrgName,
        org_description: orgDescription.trim(),
        org_website: websiteCheck.normalizedUrl,
        org_email: orgEmail.trim(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      if (orgError) throw orgError;
    }

    return {
      ...user,
      id: authUser.id,
      email: authUser.email,
      role,
      first_name: nextFirst,
      last_name: nextLast,
      zip_code: zipCode.trim(),
      radius_miles: normalizeRadiusMiles(DEFAULT_RADIUS_MILES),
      full_name: isOrganizer ? nextOrgName : `${nextFirst} ${nextLast}`.trim() || authUser.email,
      org_name: isOrganizer ? nextOrgName : "",
    };
  };

  // Step 2 submit — email signup OR finish OAuth/incomplete profile
  const handleStep2 = async (e) => {
    e.preventDefault();
    setError("");
    const isOrganizer = role === "organizer";
    if (isOrganizer) {
      if (!orgName || !orgDescription || !orgWebsite || !orgEmail) {
        return setError("Please complete all required organization fields.");
      }
      const websiteCheck = validateRequiredPublicWebsite(orgWebsite);
      if (!websiteCheck.ok) return setError(websiteCheck.reason);
    } else {
      if (!firstName || !lastName) return setError("Please enter your first and last name.");
    }
    if (!zipCode || !/^\d{5}$/.test(zipCode.trim())) {
      return setError("Please enter a valid 5-digit zip code.");
    }

    const finishingExisting = Boolean(user && !isProfileComplete(user));
    if (finishingExisting && !agreedToRules) {
      return setError("You must agree to the Terms of Service, Privacy Policy, and Community Rules to continue.");
    }
    if (!finishingExisting && (hpField || Date.now() - formLoadTime < REGISTER_MIN_SUBMIT_MS)) {
      return setError("Something went wrong. Please try again.");
    }
    if (!finishingExisting && TURNSTILE_SITE_KEY && !turnstileToken) {
      return setError("Please wait a moment — security check is still loading.");
    }

    setLoading(true);
    try {
      if (finishingExisting) {
        const nextUser = await finalizeProfile(
          (await supabase.auth.getUser()).data.user || { id: user.id, email: user.email }
        );
        setUser(nextUser);
        await checkUserAuth();
        window.location.href = "/";
        return;
      }

      await assertTurnstilePassed({
        action: TURNSTILE_ACTION_REGISTER,
        token: turnstileToken,
        honeypot: hpField,
        formLoadedAt: formLoadTime,
      });

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            role,
            first_name: isOrganizer ? "" : toStrictTitleCase(firstName.trim()),
            last_name: isOrganizer ? "" : toStrictTitleCase(lastName.trim()),
            zip_code: zipCode.trim(),
            radius_miles: normalizeRadiusMiles(DEFAULT_RADIUS_MILES),
            org_name: isOrganizer ? formatActivityTitle(orgName.trim()) : null,
            org_description: isOrganizer ? orgDescription.trim() : null,
            org_website: isOrganizer ? orgWebsite.trim() : null,
            org_email: isOrganizer ? orgEmail.trim() : null,
          },
        },
      });
      if (signUpError) throw signUpError;

      // If email confirmation is disabled, session exists immediately — finish profile now.
      if (data.session?.user) {
        await finalizeProfile(data.session.user);
        window.location.href = "/";
        return;
      }

      setStep(3);
    } catch (err) {
      turnstileRef.current?.reset();
      setTurnstileToken("");
      setError(err.message || "Registration failed. Please try again.");
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setError("");
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (resendError) throw resendError;
    } catch (err) {
      setError(err.message || "Failed to resend email.");
    }
  };

  const handleVerify = async () => {
    window.location.href = "/login";
  };

  const finishingExisting = Boolean(user && !isProfileComplete(user));
  const showCompleteFlow = finishingExisting || (completingOAuth && step === 2);
  const orgWebsiteCheck =
    role === "organizer" && orgWebsite.trim() ? validateRequiredPublicWebsite(orgWebsite) : null;
  const orgWebsiteError = orgWebsiteCheck && !orgWebsiteCheck.ok ? orgWebsiteCheck.reason : "";

  if (!ready || isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">

        {/* Branded header — same mark as AuthLayout / Login */}
        <div className="text-center mb-8">
          <Link
            to={showCompleteFlow ? "#" : "/"}
            className="inline-flex flex-col items-center gap-3 mb-4"
            onClick={(e) => showCompleteFlow && e.preventDefault()}
          >
            <img
              src="/logo.png"
              alt="LocalKidsCalendar"
              className="h-20 w-20 object-contain border border-gray-300 rounded-xl bg-white"
            />
            <span className="font-heading font-bold text-xl leading-tight">
              <span className="text-foreground">LocalKids</span>
              <span className="text-mint-500">Calendar</span>
            </span>
          </Link>
          <h1 className="font-heading font-bold text-2xl text-foreground">
            {showCompleteFlow ? "Finish your profile" : "Create your account"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {showCompleteFlow
              ? "Choose your account type and add your details to continue"
              : "Join our community of parents and activity organizers"}
          </p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          <StepBar step={step} completeOnly={showCompleteFlow} />

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Step 1: Account Details ── */}
          {step === 1 && !showCompleteFlow && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="absolute left-[-9999px]" aria-hidden="true">
                <Label htmlFor="hp_website">Website</Label>
                <input
                  id="hp_website"
                  name={TURNSTILE_HONEYPOT_FIELD}
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={hpField}
                  onChange={(e) => setHpField(e.target.value)}
                />
              </div>
              <Button type="button" variant="outline" className="w-full h-11 font-medium rounded-xl" onClick={handleGoogle}>
                <GoogleIcon className="w-5 h-5 mr-2" /> Continue with Google
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground">or sign up with email</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-heading font-semibold text-sm">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" autoComplete="email" autoFocus placeholder="you@example.com"
                    value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 rounded-xl h-11" required />
                </div>
                <p className="text-xs text-muted-foreground">Each email address can only be used for one account.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-heading font-semibold text-sm">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" autoComplete="new-password" placeholder="At least 6 characters"
                    value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 rounded-xl h-11" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm" className="font-heading font-semibold text-sm">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="confirm" type="password" autoComplete="new-password" placeholder="••••••••"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 rounded-xl h-11" required />
                </div>
              </div>

              <div className="rounded-xl border border-mint-200 bg-mint-50 p-3 text-sm text-mint-700">
                Before joining, please review our{" "}
                <Link to="/terms" target="_blank" className="font-semibold underline underline-offset-2 hover:text-mint-600">
                  Terms of Service
                </Link>
                {", "}
                <Link to="/privacy" target="_blank" className="font-semibold underline underline-offset-2 hover:text-mint-600">
                  Privacy Policy
                </Link>
                {", and "}
                <Link to="/about#community-rules" target="_blank" className="font-semibold underline underline-offset-2 hover:text-mint-600">
                  Community Rules
                </Link>
                . All members are expected to post accurate, family-friendly content and treat others with respect.
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="rules" checked={agreedToRules} onCheckedChange={setAgreedToRules} className="mt-0.5" />
                <Label htmlFor="rules" className="text-sm font-normal cursor-pointer leading-snug text-foreground">
                  I have read and agree to the{" "}
                  <Link to="/terms" target="_blank" className="text-mint-600 underline underline-offset-2 hover:text-mint-700" onClick={(e) => e.stopPropagation()}>
                    Terms of Service
                  </Link>
                  {", "}
                  <Link to="/privacy" target="_blank" className="text-mint-600 underline underline-offset-2 hover:text-mint-700" onClick={(e) => e.stopPropagation()}>
                    Privacy Policy
                  </Link>
                  {", and "}
                  <Link to="/about#community-rules" target="_blank" className="text-mint-600 underline underline-offset-2 hover:text-mint-700" onClick={(e) => e.stopPropagation()}>
                    Community Rules
                  </Link>
                </Label>
              </div>

              <Button type="submit" className="w-full h-11 rounded-xl bg-mint-500 hover:bg-mint-600 text-white font-semibold" disabled={!agreedToRules}>
                Continue →
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-mint-500 font-semibold hover:underline">Log in</Link>
              </p>
            </form>
          )}

          {/* ── Step 2: Profile Setup ── */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-5">
              {showCompleteFlow && (
                <p className="text-sm text-muted-foreground -mt-1">
                  Signed in as <span className="font-medium text-foreground">{email || user?.email}</span>
                </p>
              )}

              <div className="space-y-2">
                <Label className="font-heading font-semibold text-sm">I am joining as a…</Label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "community_member", label: "Community Member", icon: Users, desc: "I want to find & share local activities" },
                    { value: "organizer", label: "Organizer", icon: Building2, desc: "I represent an organization or program" },
                  ].map(({ value, label, icon: Icon, desc }) => (
                    <button key={value} type="button" onClick={() => setRole(value)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 text-left transition-colors
                        ${role === value ? "border-mint-500 bg-mint-50" : "border-border bg-white hover:border-mint-200"}`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${role === value ? "text-mint-500" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-semibold ${role === value ? "text-mint-600" : "text-foreground"}`}>{label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                    </button>
                  ))}
                </div>
                <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Your account type cannot be changed after you complete registration.</span>
                </div>
              </div>

              {role === "community_member" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm">First Name *</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(toStrictTitleCase(e.target.value))}
                      className="rounded-xl"
                      placeholder="Jane"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm">Last Name *</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(toStrictTitleCase(e.target.value))}
                      className="rounded-xl"
                      placeholder="Smith"
                      required
                    />
                  </div>
                  <div className="space-y-1 col-span-2 sm:col-span-1">
                    <Label className="font-heading font-semibold text-sm flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Zip Code *</Label>
                    <Input
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      className="rounded-xl"
                      placeholder="90210"
                      maxLength={5}
                      required
                    />
                  </div>
                  <BetaZipOutsideNote betaConfig={betaConfig} zipCode={zipCode} />
                </div>
              )}

              {role === "organizer" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm">Organization Name *</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(formatActivityTitle(e.target.value))}
                      className="rounded-xl"
                      placeholder="Happy Kids Soccer League"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm">Description *</Label>
                    <Input value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} className="rounded-xl" placeholder="Brief description of your organization" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="font-heading font-semibold text-sm">Website *</Label>
                      <Input
                        value={orgWebsite}
                        onChange={(e) => setOrgWebsite(e.target.value)}
                        className="rounded-xl"
                        placeholder="https://www.example.com"
                        required
                      />
                      {orgWebsiteError && (
                        <p className="text-xs text-red-600">{orgWebsiteError}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="font-heading font-semibold text-sm">Org Email *</Label>
                      <Input type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} className="rounded-xl" placeholder="info@example.com" required />
                    </div>
                    <div className="space-y-1 col-span-2 sm:col-span-1">
                      <Label className="font-heading font-semibold text-sm flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Zip Code *</Label>
                      <Input
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                        className="rounded-xl"
                        placeholder="90210"
                        maxLength={5}
                        required
                      />
                    </div>
                    <BetaZipOutsideNote betaConfig={betaConfig} zipCode={zipCode} />
                  </div>
                </div>
              )}

              {showCompleteFlow && (
                <>
                  <div className="rounded-xl border border-mint-200 bg-mint-50 p-3 text-sm text-mint-700">
                    Before joining, please review our{" "}
                    <Link to="/terms" target="_blank" className="font-semibold underline underline-offset-2 hover:text-mint-600">
                      Terms of Service
                    </Link>
                    {", "}
                    <Link to="/privacy" target="_blank" className="font-semibold underline underline-offset-2 hover:text-mint-600">
                      Privacy Policy
                    </Link>
                    {", and "}
                    <Link to="/about#community-rules" target="_blank" className="font-semibold underline underline-offset-2 hover:text-mint-600">
                      Community Rules
                    </Link>
                    .
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox id="rules-complete" checked={agreedToRules} onCheckedChange={setAgreedToRules} className="mt-0.5" />
                    <Label htmlFor="rules-complete" className="text-sm font-normal cursor-pointer leading-snug text-foreground">
                      I have read and agree to the{" "}
                      <Link to="/terms" target="_blank" className="text-mint-600 underline underline-offset-2 hover:text-mint-700" onClick={(e) => e.stopPropagation()}>
                        Terms of Service
                      </Link>
                      {", "}
                      <Link to="/privacy" target="_blank" className="text-mint-600 underline underline-offset-2 hover:text-mint-700" onClick={(e) => e.stopPropagation()}>
                        Privacy Policy
                      </Link>
                      {", and "}
                      <Link to="/about#community-rules" target="_blank" className="text-mint-600 underline underline-offset-2 hover:text-mint-700" onClick={(e) => e.stopPropagation()}>
                        Community Rules
                      </Link>
                    </Label>
                  </div>
                </>
              )}

              {!showCompleteFlow && (
                <TurnstileWidget
                  ref={turnstileRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  action={TURNSTILE_ACTION_REGISTER}
                  onToken={setTurnstileToken}
                  onError={() => setTurnstileToken("")}
                />
              )}

              <div className="flex gap-3 pt-1">
                {showCompleteFlow ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl flex-1 h-11"
                    onClick={() => logout(true)}
                  >
                    Sign out
                  </Button>
                ) : (
                  <Button type="button" variant="outline" className="rounded-xl flex-1 h-11" onClick={() => { setStep(1); setError(""); setTurnstileToken(""); }}>
                    ← Back
                  </Button>
                )}
                <Button
                  type="submit"
                  className="rounded-xl flex-1 h-11 bg-mint-500 hover:bg-mint-600 text-white font-semibold"
                  disabled={
                    loading
                    || (showCompleteFlow && !agreedToRules)
                    || (!showCompleteFlow && Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)
                  }
                >
                  {loading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : showCompleteFlow
                      ? "Save And Continue →"
                      : "Send Verification Code →"}
                </Button>
              </div>
            </form>
          )}

          {/* ── Step 3: Email Verification ── */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-mint-50 border border-mint-200 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-7 h-7 text-mint-500" />
                </div>
                <p className="text-sm text-muted-foreground">
                  We sent a confirmation link to <span className="font-semibold text-foreground">{email}</span>.
                  Open that email, confirm your address, then log in to finish setup.
                </p>
              </div>
              <Button className="w-full h-11 rounded-xl bg-mint-500 hover:bg-mint-600 text-white font-semibold"
                onClick={handleVerify}>
                Go to Log in
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Didn't receive the email?{" "}
                <button onClick={handleResend} className="text-mint-500 font-semibold hover:underline">Resend</button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
