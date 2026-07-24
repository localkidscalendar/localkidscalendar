import { createClient } from "@supabase/supabase-js";

/** Statuses that hold a zip-code ad slot (mirrors src/pages/AdManager.jsx). */
export const SLOT_HOLDING_STATUSES = ["active", "pending_payment", "pending_review", "flagged", "past_due"];

export function getEnv(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    if (process.env[key]) return process.env[key];
  }
  return "";
}

/** Anon-key client scoped to the caller's JWT — used to verify the signed-in user. */
export function createUserClient(token) {
  const supabaseUrl = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const anonKey = getEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Server missing Supabase configuration");
  }
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** Service-role client for privileged reads/writes (bypasses RLS). */
export function createAdminClient() {
  const supabaseUrl = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Server missing Supabase service role configuration");
  }
  return createClient(supabaseUrl, serviceKey);
}

/** Verify the Bearer token from an incoming request and return the auth user. */
export async function requireUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { error: "Unauthorized", status: 401 };

  const userClient = createUserClient(token);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    return { error: "Unauthorized", status: 401 };
  }
  return { user: data.user, token };
}

/** Annual price after the plan's percent discount, rounded to cents. */
export function computeAnnualPrice(monthlyRate, discountPercent) {
  const raw = Number(monthlyRate) * 12 * (1 - Number(discountPercent || 0) / 100);
  return Math.round(raw * 100) / 100;
}

/** Current ad rates — the single source of truth for checkout price_data. */
export async function getPricing(adminClient) {
  const { data } = await adminClient
    .from("ad_pricing_config")
    .select("monthly_rate, annual_discount_percent")
    .eq("config_key", "global")
    .maybeSingle();

  return {
    monthly_rate: Number(data?.monthly_rate ?? 150),
    annual_discount_percent: Number(data?.annual_discount_percent ?? 30),
  };
}

export function planDates(planType, from = new Date()) {
  const start = new Date(from);
  const end = new Date(from);
  if (planType === "annual") end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}
