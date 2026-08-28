import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "@/lib/apiBase";

async function getAccessToken() {
  const { data: sessionData, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("You must be signed in to continue.");
  return accessToken;
}

async function postJson(path, body) {
  const accessToken = await getAccessToken();
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = {};
  }

  if (!res.ok) {
    const detail = payload.error || (raw && raw.length < 200 ? raw : null);
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return payload;
}

/**
 * Start (or bypass, for admins) Stripe Checkout for a new Supporter ad.
 * Returns either { url, ad_id } to redirect to Stripe, or { ad_id, admin_bypass: true }
 * when the caller is an admin and the ad was activated immediately.
 */
export async function createAdCheckout({
  plan_type,
  zip_code,
  business_name,
  link_url,
  image_url,
  ad_library_id,
  discount_code,
  waitlist_entry_id,
  success_url,
  cancel_url,
  agree_terms,
  agree_exact_zip,
  agree_no_refunds,
} = {}) {
  return postJson("/api/create-ad-checkout", {
    plan_type,
    zip_code,
    business_name,
    link_url,
    image_url,
    ad_library_id,
    discount_code,
    waitlist_entry_id,
    success_url,
    cancel_url,
    agree_terms,
    agree_exact_zip,
    agree_no_refunds,
  });
}

/** Resume Stripe Checkout for an ad left in pending_payment (e.g. user backed out of Stripe). */
export async function resumeAdCheckout({ ad_id, success_url, cancel_url } = {}) {
  return postJson("/api/resume-ad-checkout", { ad_id, success_url, cancel_url });
}

/** Open the Stripe billing portal for an ad's subscription. Returns the portal URL. */
export async function openBillingPortal({ ad_id, return_url } = {}) {
  const { url } = await postJson("/api/billing-portal", { ad_id, return_url });
  return url;
}

/** Load the masked default card on file for an ad (brand, last4, expiry). Never returns a full number. */
export async function getAdPaymentMethod({ ad_id } = {}) {
  const { card } = await postJson("/api/ad-payment-method", { ad_id });
  return card || null;
}

export function formatMaskedCard(card) {
  if (!card?.last4) return null;
  const brand = card.brand
    ? `${card.brand.charAt(0).toUpperCase()}${card.brand.slice(1)}`
    : "Card";
  const exp =
    card.exp_month && card.exp_year
      ? ` · Exp ${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}`
      : "";
  return `${brand} •••• ${card.last4}${exp}`;
}

/** Cancel auto-renewal for an ad's subscription (runs through the end of the paid term). */
export async function cancelAdRenewal({ ad_id } = {}) {
  return postJson("/api/cancel-ad-renewal", { ad_id });
}

/** Schedule or cancel a monthly ↔ annual plan switch at next renewal. */
export async function requestAdPlanChange({ ad_id, action } = {}) {
  return postJson("/api/request-ad-plan-change", { ad_id, action });
}
