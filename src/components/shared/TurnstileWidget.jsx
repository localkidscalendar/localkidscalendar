import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

const SCRIPT_ID = "cf-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.turnstile));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Cloudflare Turnstile widget (Managed / invisible-style challenge).
 * @param {{ siteKey?: string, action?: string, onToken?: (token: string) => void, onError?: () => void, className?: string }} props
 */
const TurnstileWidget = forwardRef(function TurnstileWidget(
  { siteKey, action = "contact", onToken, onError, className = "" },
  ref
) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useImperativeHandle(ref, () => ({
    reset() {
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }));

  useEffect(() => {
    if (!siteKey || !containerRef.current) return undefined;

    let cancelled = false;

    loadTurnstileScript()
      .then((turnstile) => {
        if (cancelled || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action,
          callback: (token) => onToken?.(token),
          "error-callback": () => onError?.(),
          "expired-callback": () => onToken?.(""),
        });
      })
      .catch(() => onError?.());

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* ignore */
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, action, onToken, onError]);

  if (!siteKey) {
    return (
      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Contact form protection is not configured (missing Turnstile site key).
      </p>
    );
  }

  return <div ref={containerRef} className={className} />;
});

export default TurnstileWidget;
