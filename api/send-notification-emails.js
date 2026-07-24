import { createAdminClient, requireUser } from "./_lib/stripeHelpers.js";
import {
  sendMatchingDigests,
  sendPreviewDigest,
} from "./_lib/sendNotificationDigestsCore.js";

const ADMIN_EMAILS = new Set(["localkidscalendar@gmail.com"]);

/**
 * Admin digest sender. Body: { frequency?: 'weekly', preview_to? }
 * Only weekly digests are supported. preview_to → one email (ignores prefs).
 * Otherwise → users with frequency = weekly.
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { user, error: authError, status: authStatus } = await requireUser(req);
    if (authError) return res.status(authStatus).json({ error: authError });

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role, email, first_name")
      .eq("id", user.id)
      .maybeSingle();
    const email = (profile?.email || user.email || "").trim().toLowerCase();
    if (profile?.role !== "admin" && !ADMIN_EMAILS.has(email)) {
      return res.status(403).json({ error: "Forbidden — admin role required" });
    }

    const previewTo = typeof req.body?.preview_to === "string" ? req.body.preview_to.trim() : "";

    if (previewTo) {
      const result = await sendPreviewDigest(admin, {
        to: previewTo,
        userName: profile?.first_name || "there",
        frequency: "weekly",
      });
      return res.status(200).json(result);
    }

    const result = await sendMatchingDigests(admin, { frequencies: ["weekly"] });
    return res.status(200).json(result);
  } catch (error) {
    console.error("send-notification-emails error:", error);
    return res.status(500).json({ error: error.message || "Failed to send digests" });
  }
}
