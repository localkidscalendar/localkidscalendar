import { supabase } from "@/lib/supabaseClient";

// Path avoids the substring "ad" so browser ad-blockers don't return fake 404s.
const PRODUCTION_API = "https://localkidscalendar.vercel.app/api/creative-review";

function candidateUrls() {
  const urls = [];
  if (typeof window !== "undefined" && window.location?.origin) {
    urls.push(`${window.location.origin}/api/creative-review`);
  }
  if (!urls.includes(PRODUCTION_API)) {
    urls.push(PRODUCTION_API);
  }
  return urls;
}

async function postReview(url, token, adLibraryId) {
  const res = await fetch(url, {
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
    return {
      ok: false,
      status: res.status,
      error: res.ok
        ? "Review API returned a non-JSON response."
        : `Review failed (${res.status}).`,
    };
  }
  return { ok: res.ok, status: res.status, payload };
}

/**
 * Runs automated creative moderation (URL + image) via Vercel API.
 */
export async function moderateAdContent(adLibraryId) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated — please sign in again.");

  let lastError = "Automated review failed.";
  for (const url of candidateUrls()) {
    const result = await postReview(url, token, adLibraryId);
    if (result.status === 404) {
      lastError = `Review failed (404) at ${url}`;
      continue;
    }
    if (!result.ok) {
      throw new Error(result.payload?.error || result.error || `Review failed (${result.status})`);
    }
    const status = result.payload?.status;
    if (status !== "approved" && status !== "declined") {
      throw new Error(result.payload?.error || "Review did not return an approve/decline result.");
    }
    return { status, reason: result.payload.reason || "" };
  }

  throw new Error(lastError);
}
