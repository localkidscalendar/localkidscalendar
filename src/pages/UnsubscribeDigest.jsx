import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/apiBase";

export default function UnsubscribeDigest() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const doneParam = params.get("done");
  const errorParam = params.get("error");
  const [status, setStatus] = useState(
    doneParam === "1" ? "done" : errorParam ? "error" : token ? "loading" : "missing"
  );

  useEffect(() => {
    if (doneParam === "1" || errorParam || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/unsubscribe-digest?token=${encodeURIComponent(token)}`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!cancelled) setStatus(res.ok ? "done" : "error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, doneParam, errorParam]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Weekly Digests</h1>
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-mint-500" />
            <p className="text-sm">Turning off your weekly activity digest…</p>
          </div>
        )}
        {status === "done" && (
          <>
            <p className="text-sm text-muted-foreground">
              You’re unsubscribed from weekly activity digest emails. You can turn them back on anytime in My Account → Email Notifications.
            </p>
            <Link to="/account" className="inline-block text-sm font-medium text-mint-600 hover:text-mint-700">
              Go to My Account
            </Link>
          </>
        )}
        {status === "error" && (
          <p className="text-sm text-muted-foreground">
            We couldn’t process that unsubscribe link. It may be invalid or expired. Sign in and manage preferences under{" "}
            <Link to="/account" className="text-mint-600 hover:text-mint-700 font-medium">
              My Account → Email Notifications
            </Link>
            .
          </p>
        )}
        {status === "missing" && (
          <p className="text-sm text-muted-foreground">
            Missing unsubscribe token. To manage digests, open{" "}
            <Link to="/account" className="text-mint-600 hover:text-mint-700 font-medium">
              My Account → Email Notifications
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
