import { createClient } from "@supabase/supabase-js";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^::1$/,
  /^\[::1\]$/,
  /^fc00:/i,
  /^fe80:/i,
  /\.local$/i,
  /\.internal$/i,
];

const UNSAFE_URL_PATTERN =
  /\b(porn|xxx|adult|sex|escort|nude|onlyfans|camgirl|gambling|casino|weed|cocaine|viagra)\b/i;

function isPrivateOrUnsafeUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
}

function normalizeUrl(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function checkUrlSafety(linkUrl) {
  let normalizedUrl = normalizeUrl(linkUrl);
  if (!normalizedUrl) {
    return { ok: false, reason: "A destination URL is required." };
  }

  try {
    const parsed = new URL(normalizedUrl);
    if (UNSAFE_URL_PATTERN.test(parsed.hostname + parsed.pathname)) {
      return {
        ok: false,
        reason: "The destination URL appears inappropriate for a family audience. Please use a safe, business-related link.",
      };
    }
  } catch {
    return {
      ok: false,
      reason: "The destination URL is not valid. Please enter a full working link (e.g. https://yourbusiness.com).",
    };
  }

  if (isPrivateOrUnsafeUrl(normalizedUrl)) {
    return {
      ok: false,
      reason: "The destination URL points to a private or internal address and cannot be used.",
    };
  }

  let urlStatus = null;
  try {
    const headCheck = await fetch(normalizedUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout?.(8000),
    });
    urlStatus = headCheck.status;
  } catch {
    try {
      const getCheck = await fetch(normalizedUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout?.(10000),
      });
      urlStatus = getCheck.status;
    } catch {
      urlStatus = null;
    }
  }

  if (urlStatus === 404) {
    return {
      ok: false,
      reason: "The destination URL returned a 404 (page not found). Please check that the link is correct.",
    };
  }

  return { ok: true, normalizedUrl };
}

async function reviewWithOpenAI({ linkUrl, imageUrl }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Without a vision key, pass URL checks only and auto-approve images.
    // Community flagging remains the safety net — same fallback as Base44 when AI failed.
    return { status: "approved", reason: "" };
  }

  const prompt = `You are a content moderator for a family-friendly community website focused on kids' activities.

Review the following advertisement:
- Destination URL: ${linkUrl}
- Ad Image URL: ${imageUrl}

Evaluate BOTH the destination URL and the ad image.

STEP A — Destination URL review:
Based on the URL/domain alone, decline if it strongly suggests adult/pornographic content, illegal products/services (drugs, weapons, gambling), hate/extremist content, or obvious scam/phishing patterns.

STEP B — Ad Image review (only clear, obvious violations):
1. Nudity or sexually explicit content
2. Graphic violence or gore
3. Hate speech or discriminatory symbols
4. Illegal products or services (drugs, weapons, gambling)
5. Completely illegible or blank image
6. Content clearly inappropriate for children or families

Return ONLY valid JSON:
{"status":"approved"|"declined","reason":"explanation if declined, else empty string"}

Be lenient on imagery — only decline clear violations. Be firm on unsafe URL domains.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("OpenAI moderation failed:", response.status, text);
    // Fail open like the original Base44 path so advertisers are not blocked by outages.
    return { status: "approved", reason: "" };
  }

  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "approved", reason: "" };
  }

  const status = parsed.status === "declined" ? "declined" : "approved";
  return { status, reason: typeof parsed.reason === "string" ? parsed.reason : "" };
}

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

    if (!supabaseUrl || !serviceKey || !anonKey) {
      return res.status(500).json({ error: "Server missing Supabase configuration" });
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

    const { ad_library_id: adLibraryId } = req.body || {};
    if (!adLibraryId) {
      return res.status(400).json({ error: "ad_library_id required" });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: ad, error: adError } = await admin
      .from("ad_library")
      .select("*")
      .eq("id", adLibraryId)
      .maybeSingle();

    if (adError || !ad) {
      return res.status(404).json({ error: "Ad not found" });
    }

    if (ad.user_id !== userData.user.id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profile?.role !== "admin") {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const urlCheck = await checkUrlSafety(ad.link_url);
    if (!urlCheck.ok) {
      await admin.from("ad_library").update({
        moderation_status: "declined",
        moderation_notes: urlCheck.reason,
        moderation_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", adLibraryId);
      return res.status(200).json({ status: "declined", reason: urlCheck.reason });
    }

    if (urlCheck.normalizedUrl && urlCheck.normalizedUrl !== ad.link_url) {
      await admin.from("ad_library").update({
        link_url: urlCheck.normalizedUrl,
        updated_at: new Date().toISOString(),
      }).eq("id", adLibraryId);
    }

    let aiResult;
    try {
      aiResult = await reviewWithOpenAI({
        linkUrl: urlCheck.normalizedUrl || ad.link_url,
        imageUrl: ad.image_url,
      });
    } catch (err) {
      console.error("Vision review error:", err);
      aiResult = { status: "approved", reason: "" };
    }

    const newStatus = aiResult.status === "declined" ? "declined" : "approved";
    await admin.from("ad_library").update({
      moderation_status: newStatus,
      moderation_notes: aiResult.reason || "",
      moderation_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", adLibraryId);

    return res.status(200).json({ status: newStatus, reason: aiResult.reason || "" });
  } catch (error) {
    console.error("moderate-ad-content error:", error);
    return res.status(500).json({ error: error.message || "Moderation failed" });
  }
}
