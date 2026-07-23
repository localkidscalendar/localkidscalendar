import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import GoogleIcon from "@/components/GoogleIcon";
import { Mail, Lock, Loader2, Users, Building2, MapPin, CheckCircle, AlertTriangle } from "lucide-react";

// Step indicator
function StepBar({ step }) {
  const steps = ["Account", "Profile", "Verify"];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
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
              <div className={`h-0.5 w-12 mb-5 mx-1 transition-colors ${step > idx ? "bg-mint-500" : "bg-border"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function Register() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  // Step 3 — email confirmation

  // Bot protection: honeypot field must stay empty, and a human can't reach step 2 in under 3 seconds
  const [hpField, setHpField] = useState("");
  const [formLoadTime] = useState(() => Date.now());

  const handleGoogle = async () => {
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
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
    if (!agreedToRules) return setError("You must agree to the Community Rules to continue.");
    setStep(2);
  };

  // Step 2 submit — registers with Supabase and sends confirmation email
  const handleStep2 = async (e) => {
    e.preventDefault();
    setError("");
    const isOrganizer = role === "organizer";
    if (isOrganizer) {
      if (!orgName || !orgDescription || !orgWebsite || !orgEmail) {
        return setError("Please complete all required organization fields.");
      }
    } else {
      if (!firstName || !lastName) return setError("Please enter your first and last name.");
    }
    if (!zipCode) return setError("Please enter your zip code.");
    if (hpField || Date.now() - formLoadTime < 3000) {
      return setError("Something went wrong. Please try again.");
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            role,
            first_name: isOrganizer ? "" : firstName,
            last_name: isOrganizer ? "" : lastName,
            zip_code: zipCode,
            org_name: isOrganizer ? orgName : null,
            org_description: isOrganizer ? orgDescription : null,
            org_website: isOrganizer ? orgWebsite : null,
            org_email: isOrganizer ? orgEmail : null,
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
      setError(err.message || "Registration failed. Please try again.");
    }
    setLoading(false);
  };

  const finalizeProfile = async (authUser) => {
    const isOrganizer = role === "organizer";
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authUser.id,
      email: authUser.email,
      role,
      first_name: isOrganizer ? "" : firstName,
      last_name: isOrganizer ? "" : lastName,
      zip_code: zipCode,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw profileError;

    if (isOrganizer) {
      const { error: orgError } = await supabase.from("organizers").insert({
        user_id: authUser.id,
        org_name: orgName,
        org_description: orgDescription,
        org_website: orgWebsite,
        org_email: orgEmail,
      });
      if (orgError) throw orgError;
    }
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

  // Kept for older UI path; confirmation is now email-link based.
  const handleVerify = async () => {
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">

        {/* Branded header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-4">
            <span className="font-display font-bold text-2xl text-primary">
              🌿 LocalKids<span className="text-mint-500">Calendar</span>
            </span>
          </Link>
          <h1 className="font-heading font-bold text-2xl text-foreground">Create your account</h1>
          <p className="text-muted-foreground text-sm mt-1">Join our community of parents and activity organizers</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          <StepBar step={step} />

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Step 1: Account Details ── */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              {/* Honeypot field - hidden from real users, bots often fill every field */}
              <div className="absolute left-[-9999px]" aria-hidden="true">
                <Label htmlFor="hp_website">Website</Label>
                <input
                  id="hp_website"
                  name="hp_website"
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
                Before joining, please{" "}
                <Link to="/about#community-rules" target="_blank" className="font-semibold underline underline-offset-2 hover:text-mint-600">
                  review our Community Rules (Terms of Service and Privacy)
                </Link>
                . All members are expected to post accurate, family-friendly content and treat others with respect.
              </div>
              <div className="flex items-start gap-3">
                <Checkbox id="rules" checked={agreedToRules} onCheckedChange={setAgreedToRules} className="mt-0.5" />
                <Label htmlFor="rules" className="text-sm font-normal cursor-pointer leading-snug text-foreground">
                  I have read and agree to our{" "}
                  <Link to="/about#community-rules" target="_blank" className="text-mint-600 underline underline-offset-2 hover:text-mint-700" onClick={(e) => e.stopPropagation()}>
                    Community Rules (Terms of Service and Privacy)
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
              {/* Account type */}
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

              {/* Community Member fields */}
              {role === "community_member" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm">First Name *</Label>
                    <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="rounded-xl" placeholder="Jane" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm">Last Name *</Label>
                    <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="rounded-xl" placeholder="Smith" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Zip Code *</Label>
                    <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="rounded-xl" placeholder="90210" maxLength={5} required />
                  </div>
                </div>
              )}

              {/* Organizer fields */}
              {role === "organizer" && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm">Organization Name *</Label>
                    <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="rounded-xl" placeholder="Happy Kids Soccer League" required />
                  </div>
                  <div className="space-y-1">
                    <Label className="font-heading font-semibold text-sm">Description *</Label>
                    <Input value={orgDescription} onChange={(e) => setOrgDescription(e.target.value)} className="rounded-xl" placeholder="Brief description of your organization" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="font-heading font-semibold text-sm">Website *</Label>
                      <Input value={orgWebsite} onChange={(e) => setOrgWebsite(e.target.value)} className="rounded-xl" placeholder="www.example.com" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-heading font-semibold text-sm">Org Email *</Label>
                      <Input type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} className="rounded-xl" placeholder="info@example.com" required />
                    </div>
                    <div className="space-y-1">
                      <Label className="font-heading font-semibold text-sm flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Zip Code *</Label>
                      <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className="rounded-xl" placeholder="90210" maxLength={5} required />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="rounded-xl flex-1 h-11" onClick={() => { setStep(1); setError(""); }}>
                  ← Back
                </Button>
                <Button type="submit" className="rounded-xl flex-1 h-11 bg-mint-500 hover:bg-mint-600 text-white font-semibold" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Verification Code →"}
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