/**
 * Resolve API routes. Serverless functions live on the Vercel deployment.
 * Same-origin on the production hosts (custom domain + *.vercel.app). Local Vite
 * (and other hosts) fall back to the primary domain unless VITE_API_BASE_URL is set.
 */
export function apiUrl(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const configured = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (configured) return `${configured}${normalized}`;

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (
      host.endsWith(".vercel.app")
      || host === "localkidscalendar.com"
      || host === "www.localkidscalendar.com"
    ) {
      return normalized;
    }
  }

  return `https://localkidscalendar.com${normalized}`;
}
