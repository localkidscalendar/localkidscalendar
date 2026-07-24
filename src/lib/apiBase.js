/**
 * Resolve API routes. Serverless functions live on the Vercel deployment.
 * Custom domains (and local Vite) may not serve /api/*, so fall back to the
 * known Vercel app host unless VITE_API_BASE_URL overrides it.
 */
export function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const configured = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) return `${configured}${normalized}`;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.endsWith(".vercel.app")) return normalized;
  }

  return `https://localkidscalendar.vercel.app${normalized}`;
}
