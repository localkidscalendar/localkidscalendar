import { supabase } from "@/lib/supabaseClient";

/**
 * Runs automated ad creative moderation (URL + image).
 * Prefer Supabase Edge Function; fall back to Vercel /api route.
 */
export async function moderateAdContent(adLibraryId) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  // 1) Supabase Edge Function
  try {
    const { data, error } = await supabase.functions.invoke("moderate-ad-content", {
      body: { ad_library_id: adLibraryId },
    });
    if (!error && data?.status) {
      return { status: data.status, reason: data.reason || "" };
    }
    // Fall through on missing function / invoke errors
    if (error && !/not found|404|Failed to send/i.test(error.message || "")) {
      console.warn("moderate-ad-content edge function:", error.message);
    }
  } catch (err) {
    console.warn("moderate-ad-content edge invoke failed:", err?.message || err);
  }

  // 2) Vercel serverless API (production / vercel dev)
  const res = await fetch("/api/moderate-ad-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ad_library_id: adLibraryId }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error || `Moderation failed (${res.status})`);
  }
  return { status: payload.status, reason: payload.reason || "" };
}
