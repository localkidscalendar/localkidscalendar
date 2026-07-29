import crypto from "crypto";
import { createAdminClient, getEnv } from "./_lib/stripeHelpers.js";
import { upsertEmailSuppression } from "./_lib/emailGuards.js";

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Verify Resend/Svix webhook signature when RESEND_WEBHOOK_SECRET is set.
 * Secret format: whsec_... (base64 payload after prefix).
 */
function verifySvixSignature(rawBody, headers, secret) {
  if (!secret) return true; // accept until RESEND_WEBHOOK_SECRET is configured
  const msgId = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signatureHeader = headers["svix-signature"];
  if (!msgId || !timestamp || !signatureHeader) return false;

  const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 60 * 5) return false;

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const toSign = `${msgId}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(toSign).digest("base64");

  // svix-signature looks like: v1,BASE64 v1,BASE64
  const candidates = String(signatureHeader)
    .split(" ")
    .map((p) => p.trim())
    .filter((p) => p.startsWith("v1,"))
    .map((p) => p.slice(3));

  return candidates.some((sig) => {
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  });
}

async function suppressAndDisableDigest(admin, email, reason, detail) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return;

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", normalized)
    .maybeSingle();

  await upsertEmailSuppression(admin, {
    email: normalized,
    userId: profile?.id || null,
    reason,
    detail,
  });

  if (profile?.id) {
    await admin
      .from("notification_preferences")
      .update({ frequency: "none", updated_at: new Date().toISOString() })
      .eq("user_id", profile.id);
  }
}

/**
 * Resend webhook: bounce + complaint → suppression list + turn digests off.
 * Configure in Resend dashboard → Webhooks → this URL + RESEND_WEBHOOK_SECRET.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const rawBuf = await readRawBody(req);
    const rawBody = rawBuf.toString("utf8");
    const secret = getEnv("RESEND_WEBHOOK_SECRET");

    if (secret && !verifySvixSignature(rawBody, req.headers, secret)) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }

    const event = JSON.parse(rawBody || "{}");
    const type = event?.type || "";
    const data = event?.data || {};
    const email =
      data?.to?.[0] ||
      data?.email ||
      data?.from ||
      (Array.isArray(data?.to) ? data.to[0] : null);

    if (type === "email.bounced" || type === "email.failed") {
      const admin = createAdminClient();
      await suppressAndDisableDigest(
        admin,
        email,
        "bounce",
        `${type}: ${data?.bounce?.message || data?.last_event || ""}`.slice(0, 500)
      );
      return res.status(200).json({ ok: true, handled: type });
    }

    if (type === "email.complained") {
      const admin = createAdminClient();
      await suppressAndDisableDigest(
        admin,
        email,
        "complaint",
        "Resend spam complaint"
      );
      return res.status(200).json({ ok: true, handled: type });
    }

    return res.status(200).json({ ok: true, ignored: type || "unknown" });
  } catch (error) {
    console.error("resend-webhook error:", error);
    return res.status(500).json({ error: error.message || "Webhook failed" });
  }
}
