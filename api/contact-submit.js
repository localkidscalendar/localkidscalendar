import { createAdminClient } from "./_lib/stripeHelpers.js";
import { isContactRateLimited, parseContactSubmitBody } from "./_lib/contactBotGuards.js";
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

/** Silent success for bots (matches ContactUs.jsx fake thank-you). */
function silentOk(res) {
  return res.status(200).json({ ok: true });
}

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
    const parsed = parseContactSubmitBody(req.body);
    if (!parsed.ok) {
      if (parsed.bot) return silentOk(res);
      return res.status(400).json({ error: parsed.error || "Invalid submission." });
    }

    const { payload } = parsed;
    const turnstile = await verifyTurnstileToken({
      token: payload.turnstile_token,
      remoteip: clientIp(req),
      action: "contact",
    });
    if (!turnstile.success) {
      if (turnstile.skipped) {
        // Local dev without keys — allow through after honeypot/timing only.
      } else {
        return silentOk(res);
      }
    }

    const admin = createAdminClient();

    if (await isContactRateLimited(admin, payload.sender_email)) {
      return silentOk(res);
    }

    const { error } = await admin.from("contact_messages").insert({
      sender_name: payload.sender_name,
      sender_email: payload.sender_email,
      sender_phone: payload.sender_phone || "",
      subject: payload.subject,
      message: payload.message,
      status: "unread",
    });

    if (error) {
      console.error("contact-submit insert failed:", error.message);
      return res.status(500).json({ error: "Could not send message. Please try again." });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("contact-submit error:", err);
    const msg = err.message || "Could not send message.";
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      return res.status(500).json({ error: "Server configuration error." });
    }
    if (msg.includes("TURNSTILE")) {
      return res.status(500).json({ error: "Server configuration error." });
    }
    return res.status(500).json({ error: "Could not send message. Please try again." });
  }
}
