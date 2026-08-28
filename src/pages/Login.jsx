import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { useAuth } from "@/lib/AuthContext";
import { isProfileComplete } from "@/lib/authRoles";
import {
  AUTH_CONFIRMATION_INBOX_HINT,
  AUTH_CONFIRMATION_INBOX_HINT_CLASS,
  AUTH_EMAIL_NOT_CONFIRMED_HELP,
  isEmailNotConfirmedError,
} from "../../shared/authEmailCopy.js";

export default function Login() {
  const navigate = useNavigate();
  const { user, isLoadingAuth, authChecked } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showEmailConfirmHelp, setShowEmailConfirmHelp] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authChecked || isLoadingAuth || !user) return;
    if (!isProfileComplete(user)) {
      navigate("/register?complete=1", { replace: true });
      return;
    }
    if (user.role === "disabled") {
      navigate("/account-disabled", { replace: true });
      return;
    }
    navigate("/", { replace: true });
  }, [authChecked, isLoadingAuth, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setShowEmailConfirmHelp(false);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      const uid = data?.user?.id;
      if (uid) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, zip_code")
          .eq("id", uid)
          .maybeSingle();
        if (profile?.role === "disabled") {
          window.location.href = "/account-disabled";
          return;
        }
        if (!profile?.zip_code) {
          window.location.href = "/register?complete=1";
          return;
        }
      }
      window.location.href = "/";
    } catch (err) {
      if (isEmailNotConfirmedError(err)) {
        setShowEmailConfirmHelp(true);
        setError(AUTH_EMAIL_NOT_CONFIRMED_HELP);
      } else {
        setShowEmailConfirmHelp(false);
        setError(err.message || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <Button
        variant="outline"
        className="w-full h-12 text-sm font-medium mb-6"
        onClick={handleGoogle}
      >
        <GoogleIcon className="w-5 h-5 mr-2" />
        Continue with Google
      </Button>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <p>{error}</p>
          {showEmailConfirmHelp && (
            <p className={`mt-2 ${AUTH_CONFIRMATION_INBOX_HINT_CLASS}`}>{AUTH_CONFIRMATION_INBOX_HINT}</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
