import { createClient } from "@supabase/supabase-js";
import { isAdminCaller } from "./_lib/adminAuth.js";
import { sendViaResend } from "./_lib/resendSend.js";
import { getEnv } from "./_lib/stripeHelpers.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_HTML_BYTES = 200_000;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");

    if (!supabaseUrl || !anonKey) {
      return res.status(500).json({ error: "Server missing Supabase configuration" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error("auth.getUser failed:", userError?.message || "no user");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const authUser = userData.user;
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role, email")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileError) {
      console.error("profile lookup failed:", profileError.message);
      return res.status(500).json({ error: "Could not verify admin role" });
    }

    const email = (profile?.email || authUser.email || "").trim().toLowerCase();
    if (!isAdminCaller(profile, authUser.email)) {
      console.error("send-email forbidden:", {
        userId: authUser.id,
        email,
        role: profile?.role || null,
      });
      return res.status(403).json({
        error: `Forbidden — admin role required (signed in as ${email || "unknown"}, role: ${profile?.role || "none"}). If this is the site admin account, set profiles.role = 'admin' in Supabase.`,
      });
    }

    const body = req.body || {};
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const html = typeof body.html === "string" ? body.html : "";

    if (!to || !EMAIL_RE.test(to)) {
      return res.status(400).json({ error: "Valid 'to' email is required" });
    }
    if (!subject) {
      return res.status(400).json({ error: "'subject' is required" });
    }
    if (!html) {
      return res.status(400).json({ error: "'html' is required" });
    }
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      return res.status(400).json({ error: "HTML body exceeds size limit" });
    }

    const result = await sendViaResend({ to, subject, html });
    if (result.skipped) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: result.reason || "EMAIL_SENDING_ENABLED",
        id: null,
      });
    }

    return res.status(200).json({ ok: true, id: result.id || null });
  } catch (error) {
    console.error("send-email error:", error);
    return res.status(500).json({ error: error.message || "Failed to send email" });
  }
}
