import { createClient } from "@supabase/supabase-js";
import {
  getEnv,
  reviewImageHybrid,
  ACTIVITY_PHOTO_VISION_PROMPT,
  AD_CREATIVE_VISION_PROMPT,
} from "./_lib/imageModeration.js";

/**
 * Automated activity cover-photo review (Organizer postings).
 * Hybrid: Moderation API first, custom vision only on gray scores.
 * Body: { image_url }
 * Returns: { status: "approved"|"declined", reason }
 */
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

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const imageUrl = typeof req.body?.image_url === "string" ? req.body.image_url.trim() : "";
    if (!imageUrl) {
      return res.status(400).json({ error: "image_url is required" });
    }

    const reviewType = req.body?.review_type === "ad_creative" ? "ad_creative" : "activity";
    const prompt =
      reviewType === "ad_creative" ? AD_CREATIVE_VISION_PROMPT : ACTIVITY_PHOTO_VISION_PROMPT;

    let aiResult;
    try {
      aiResult = await reviewImageHybrid({
        prompt,
        imageUrl,
      });
    } catch (err) {
      console.error("photo-review hybrid error:", err);
      aiResult = { status: "approved", reason: "" };
    }

    const status = aiResult.status === "declined" ? "declined" : "approved";
    return res.status(200).json({
      status,
      reason: aiResult.reason || "",
      phase: aiResult.phase || "",
    });
  } catch (error) {
    console.error("photo-review error:", error);
    return res.status(500).json({ error: error.message || "Photo review failed" });
  }
}
