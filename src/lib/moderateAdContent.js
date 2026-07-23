import { supabase } from "@/lib/supabaseClient";

const PRODUCTION_API = "https://localkidscalendar.vercel.app/api/moderate-ad-content";

function candidateUrls() {
  const urls = [];
  if (typeof window !== "undefined" && window.location?.origin) {
    urls.push(`${window.location.origin}/api/moderate-ad-content`);
  }
  // Vite local has no /api routes; also covers custom-domain routing gaps.
  if (!urls.includes(PRODUCTION_API)) {
    urls.push(PRODUCTION_API);
  }
  return urls;
}

async function postModeration(url, token, adLibraryId) {
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
        ? "Moderation API returned a non-JSON response."
        : `Moderation failed (${res.status}).`,
    };
  }
  return { ok: res.ok, status: res.status, payload };
}

/**
 * Runs automated ad creative moderation (URL + image) via Vercel API.
 */
export async function moderateAdContent(adLibraryId) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not authenticated — please sign in again.");

  let lastError = "Moderation failed.";
  for (const url of candidateUrls()) {
    const result = await postModeration(url, token, adLibraryId);
    if (result.status === 404) {
      lastError = `Moderation failed (404) at ${url}`;
      continue;
    }
    if (!result.ok) {
      throw new Error(result.payload?.error || result.error || `Moderation failed (${result.status})`);
    }
    const status = result.payload?.status;
    if (status !== "approved" && status !== "declined") {
      throw new Error(result.payload?.error || "Moderation did not return an approve/decline result.");
    }
    return { status, reason: result.payload.reason || "" };
  }

  throw new Error(lastError);
}
