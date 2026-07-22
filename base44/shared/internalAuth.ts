// Shared helper to authorize calls to admin-only backend functions.
// Two ways a call is authorized:
//   1. A logged-in admin user (base44.auth.me().role === 'admin')
//   2. The scheduled automation, which passes this exact token in its payload.
// This avoids treating "auth.me() threw" (i.e. no token at all, which anyone can trigger)
// as proof the caller is the internal scheduler.
export const INTERNAL_CALL_TOKEN = 'lkc_internal_9f2a7d5e3c1b6480a9d4e2f7b3c8106d';

export async function isAuthorizedInternalCall(base44, payload) {
  if (payload && payload.internal_token === INTERNAL_CALL_TOKEN) return true;
  try {
    const user = await base44.auth.me();
    return !!(user && user.role === 'admin');
  } catch {
    return false;
  }
}