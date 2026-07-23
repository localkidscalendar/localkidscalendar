import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function isPrivateOrUnsafeUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return true;
  }
}

function normalizeUrl(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function checkUrlSafety(linkUrl) {
  const normalizedUrl = normalizeUrl(linkUrl);
  if (!normalizedUrl) return { ok: false, reason: "A destination URL is required." };

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
    const headCheck = await fetch(normalizedUrl, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000) });
    urlStatus = headCheck.status;
  } catch {
    try {
      const getCheck = await fetch(normalizedUrl, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(10000) });
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
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { status: "approved", reason: "" };

  const prompt = `You are a content moderator for a family-friendly community website focused on kids' activities.

Review the following advertisement:
- Destination URL: ${linkUrl}
- Ad Image URL: ${imageUrl}

Evaluate BOTH the destination URL and the ad image.

STEP A — Destination URL review:
Decline if the domain/path strongly suggests adult content, illegal products/services, hate/extremist content, or obvious scam/phishing.

STEP B — Ad Image review (only clear, obvious violations):
nudity/sexual content, graphic violence, hate symbols, illegal products, blank/illegible image, content clearly inappropriate for children/families.

Return ONLY JSON: {"status":"approved"|"declined","reason":"..."}
Be lenient on imagery; be firm on unsafe URL domains.`;

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
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }],
    }),
  });

  if (!response.ok) {
    console.error("OpenAI failed", await response.text());
    return { status: "approved", reason: "" };
  }

  const payload = await response.json();
  try {
    const parsed = JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
    return {
      status: parsed.status === "declined" ? "declined" : "approved",
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch {
    return { status: "approved", reason: "" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const { ad_library_id: adLibraryId } = await req.json();
    if (!adLibraryId) {
      return new Response(JSON.stringify({ error: "ad_library_id required" }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: ad } = await admin.from("ad_library").select("*").eq("id", adLibraryId).maybeSingle();
    if (!ad) {
      return new Response(JSON.stringify({ error: "Ad not found" }), {
        status: 404,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    if (ad.user_id !== userData.user.id) {
      const { data: profile } = await admin.from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
      if (profile?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders(), "Content-Type": "application/json" },
        });
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
      return new Response(JSON.stringify({ status: "declined", reason: urlCheck.reason }), {
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    let aiResult;
    try {
      aiResult = await reviewWithOpenAI({
        linkUrl: urlCheck.normalizedUrl || ad.link_url,
        imageUrl: ad.image_url,
      });
    } catch (err) {
      console.error(err);
      aiResult = { status: "approved", reason: "" };
    }

    const newStatus = aiResult.status === "declined" ? "declined" : "approved";
    await admin.from("ad_library").update({
      moderation_status: newStatus,
      moderation_notes: aiResult.reason || "",
      moderation_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", adLibraryId);

    return new Response(JSON.stringify({ status: newStatus, reason: aiResult.reason || "" }), {
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  }
});
