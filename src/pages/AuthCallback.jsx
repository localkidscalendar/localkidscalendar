import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

/**
 * OAuth return path. Supabase attaches the session on redirect;
 * we wait for it, then send users with an incomplete profile to Account.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing sign-in…");

  useEffect(() => {
    let cancelled = false;

    const finish = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error || !data.session?.user) {
        setMessage("Could not complete sign-in. Redirecting to login…");
        setTimeout(() => navigate("/login", { replace: true }), 1200);
        return;
      }

      const userId = data.session.user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("zip_code, first_name, role")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      const needsProfile = !profile?.zip_code;
      if (needsProfile) {
        navigate("/account?setup=1", { replace: true });
        return;
      }
      navigate("/", { replace: true });
    };

    finish();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4">
      <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
