import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";

/**
 * Automated activity cover-photo review via OpenAI vision.
 */
export async function moderateEventImage(imageUrl) {
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
    body: JSON.stringify({ image_url: imageUrl }),
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
