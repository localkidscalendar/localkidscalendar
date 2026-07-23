import { supabase } from "@/lib/supabaseClient";

/**
 * Runs automated ad creative moderation (URL + image) via Vercel API.
 */
export async function moderateAdContent(adLibraryId) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated — please sign in again.");

  // Prefer Vercel API (env vars + OpenAI live there). Edge function is optional fallback.
  const res = await fetch("/api/moderate-ad-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ad_library_id: adLibraryId }),
  });

  const raw = await res.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error(
      res.ok
        ? "Moderation API returned a non-JSON response. Redeploy may still be in progress."
        : `Moderation failed (${res.status}).`
    );
  }

  if (!res.ok) {
    throw new Error(payload.error || `Moderation failed (${res.status})`);
  }
  if (payload.status !== "approved" && payload.status !== "declined") {
    throw new Error(payload.error || "Moderation did not return an approve/decline result.");
  }

  return { status: payload.status, reason: payload.reason || "" };
}
