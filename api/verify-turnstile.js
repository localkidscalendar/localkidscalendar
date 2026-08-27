import { parseTurnstileVerifyBody } from "./_lib/turnstileFormGuards.js";
import { verifyTurnstileToken } from "./_lib/turnstileVerify.js";

function corsPreflight(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "";
}

/**
 * Shared Turnstile gate for Register + reactivation (Contact Us uses /api/contact-submit).
 * Tokens are single-use — call immediately before the protected action.
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    corsPreflight(res);
    return res.status(204).end();
  }

  corsPreflight(res);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const parsed = parseTurnstileVerifyBody(req.body);
    if (!parsed.ok) {
      if (parsed.bot) {
        return res.status(400).json({ error: "Something went wrong. Please try again." });
      }
      return res.status(400).json({ error: parsed.error || "Invalid submission." });
    }

    const { payload } = parsed;
    const turnstile = await verifyTurnstileToken({
      token: payload.turnstile_token,
      remoteip: clientIp(req),
      action: payload.action,
    });

    if (!turnstile.success) {
      if (turnstile.skipped) {
        // Local dev without keys — allow through after honeypot/timing only.
        return res.status(200).json({ ok: true, skipped: true });
      }
      return res.status(400).json({ error: "Security check failed. Please try again." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("verify-turnstile error:", err);
    return res.status(500).json({ error: "Security check failed. Please try again." });
  }
}
