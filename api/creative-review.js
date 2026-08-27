import { createClient } from "@supabase/supabase-js";
import {
  getEnv,
  reviewImageHybrid,
  AD_CREATIVE_VISION_PROMPT,
} from "./_lib/imageModeration.js";
import { validateBusinessLinkUrl } from "../shared/linkUrlSafety.js";

async function checkUrlReachability(normalizedUrl) {
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

  return { ok: true };
}

async function checkUrlSafety(linkUrl) {
  const formatCheck = validateBusinessLinkUrl(linkUrl);
  if (!formatCheck.ok) return formatCheck;

  const reachability = await checkUrlReachability(formatCheck.normalizedUrl);
  if (!reachability.ok) return reachability;

  return { ok: true, normalizedUrl: formatCheck.normalizedUrl };
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

    // Image review (URL already handled above). Hybrid: Moderation API → custom vision if gray.
    let aiResult;
    try {
      aiResult = await reviewImageHybrid({
        prompt: AD_CREATIVE_VISION_PROMPT,
        imageUrl: ad.image_url,
      });
    } catch (err) {
      console.error("Creative image review error:", err);
      aiResult = { status: "approved", reason: "" };
    }

    const newStatus = aiResult.status === "declined" ? "declined" : "approved";
    await admin.from("ad_library").update({
      moderation_status: newStatus,
      moderation_notes: aiResult.reason || "",
      moderation_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", adLibraryId);

    return res.status(200).json({
      status: newStatus,
      reason: aiResult.reason || "",
      phase: aiResult.phase || "",
    });
  } catch (error) {
    console.error("creative-review error:", error);
    return res.status(500).json({ error: error.message || "Moderation failed" });
  }
}
