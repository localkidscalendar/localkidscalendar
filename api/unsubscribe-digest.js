import { createAdminClient } from "./_lib/stripeHelpers.js";
import {
  upsertEmailSuppression,
  verifyDigestUnsubToken,
} from "./_lib/emailGuards.js";

const APP_URL = process.env.VITE_APP_URL || "https://localkidscalendar.com";

async function turnOffDigestForUser(admin, userId, email) {
  await admin
    .from("notification_preferences")
    .upsert(
      {
        user_id: userId,
        frequency: "none",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (email) {
    try {
      await upsertEmailSuppression(admin, {
        email,
        userId,
        reason: "unsubscribe",
        detail: "One-click or link unsubscribe from weekly digest",
      });
    } catch (err) {
      console.error("unsubscribe-digest: suppression upsert failed", err.message);
    }
  }
}

/**
 * One-click digest unsubscribe (List-Unsubscribe + browser link support).
 * GET  → process + redirect to /unsubscribe?done=1
 * POST → RFC 8058 one-click (List-Unsubscribe=One-Click)
 */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token =
    (typeof req.query?.token === "string" && req.query.token) ||
    (typeof req.body?.token === "string" && req.body.token) ||
    "";

  const userId = verifyDigestUnsubToken(token);
  if (!userId) {
    if (req.method === "GET") {
      return res.redirect(302, `${APP_URL}/unsubscribe?error=invalid`);
    }
    return res.status(400).json({ error: "Invalid unsubscribe token" });
  }

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", userId)
      .maybeSingle();

    await turnOffDigestForUser(admin, userId, profile?.email || null);

    if (req.method === "GET") {
      return res.redirect(302, `${APP_URL}/unsubscribe?done=1`);
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("unsubscribe-digest error:", error);
    if (req.method === "GET") {
      return res.redirect(302, `${APP_URL}/unsubscribe?error=failed`);
    }
    return res.status(500).json({ error: error.message || "Unsubscribe failed" });
  }
}
