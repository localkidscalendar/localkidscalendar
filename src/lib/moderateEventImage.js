import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";

async function callPhotoReview(imageUrl, reviewType) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("You must be signed in to continue.");

  const res = await fetch(apiUrl("/api/photo-review"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ image_url: imageUrl, review_type: reviewType }),
  });

  const raw = await res.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!res.ok) {
    throw new Error(
      payload.error || (raw && raw.length < 200 ? raw : null) || `Photo review failed (${res.status})`
    );
  }

  const status = payload?.status;
  if (status !== "approved" && status !== "declined") {
    throw new Error("Review did not return an approve/decline result.");
  }

  return { status, reason: payload.reason || "" };
}

/**
 * Automated activity cover-photo review via hybrid OpenAI Moderation + vision.
 */
export async function moderateEventImage(imageUrl) {
  return callPhotoReview(imageUrl, "activity");
}

/**
 * Automated Ad Asset image review (same API path as activity photos, ad-specific prompt).
 */
export async function moderateAdCreativeImage(imageUrl) {
  return callPhotoReview(imageUrl, "ad_creative");
}
