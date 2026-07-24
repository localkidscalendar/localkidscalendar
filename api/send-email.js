import { createClient } from "@supabase/supabase-js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_HTML_BYTES = 200_000;

function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    if (process.env[key]) return process.env[key];
  }
  return "";
}

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
    const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = getEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
    const resendKey = getEnv("RESEND_API_KEY");
    const fromEmail =
      getEnv("RESEND_FROM_EMAIL") || "Local Kids Calendar <onboarding@resend.dev>";

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return res.status(500).json({ error: "Server missing Supabase configuration" });
    }
    if (!resendKey) {
      return res.status(500).json({ error: "Server missing RESEND_API_KEY" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error("auth.getUser failed:", userError?.message || "no user");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
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

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html,
      }),
    });

    const resendPayload = await resendRes.json().catch(() => ({}));
    if (!resendRes.ok) {
      console.error("Resend error:", resendRes.status, resendPayload);
      return res.status(502).json({
        error: resendPayload?.message || "Failed to send email via Resend",
      });
    }

    return res.status(200).json({ ok: true, id: resendPayload.id || null });
  } catch (error) {
    console.error("send-email error:", error);
    return res.status(500).json({ error: error.message || "Failed to send email" });
  }
}
