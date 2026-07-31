import { defineConfig, devices } from "@playwright/test";

/**
 * Default: smoke against production (env already baked by Vercel).
 * Local preview: PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 npm run test:e2e
 *   (requires a production build with VITE_SUPABASE_* available to Vite)
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "https://localkidscalendar.com";
const isLocal = /localhost|127\.0\.0\.1/.test(baseURL);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  timeout: 60_000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(isLocal
    ? {
        webServer: {
          command: "npm run build && npm run preview -- --host 127.0.0.1 --port 4173",
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }
    : {}),
});
