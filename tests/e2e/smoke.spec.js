import { test, expect } from "@playwright/test";

/**
 * Public smoke tests — no login required.
 * Handles Stage 1 beta gate ("Private Preview") when enabled.
 * Run with: npm run test:e2e
 *
 * Optional: PLAYWRIGHT_BETA_CODE=<code> to pass the gate automatically.
 */

async function enterBetaGateIfPresent(page) {
  const code = process.env.PLAYWRIGHT_BETA_CODE?.trim();
  const gateHeading = page.getByRole("heading", { name: /Private Preview/i });
  try {
    await gateHeading.waitFor({ state: "visible", timeout: 8000 });
  } catch {
    return; // gate not shown
  }
  if (!code) {
    // Gate is on — smoke still passes if the gate UI itself loaded.
    return;
  }
  await page.getByPlaceholder(/access code/i).fill(code);
  await page.getByRole("button", { name: /^Enter$/i }).click();
  await expect(gateHeading).toBeHidden({ timeout: 10000 });
}

test.describe("public smoke", () => {
  test("home loads (app or beta gate)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Local.?Kids|Calendar/i);
    await expect(
      page.getByText(/Private Preview|Loading|Local|Calendar|Sign|Zip/i).first()
    ).toBeVisible({ timeout: 20000 });
    await enterBetaGateIfPresent(page);
  });

  test("about page is reachable past gate when possible", async ({ page }) => {
    await page.goto("/about");
    await enterBetaGateIfPresent(page);
    const body = page.locator("body");
    await expect(body).toContainText(/About|FAQ|Local|Private Preview/i, { timeout: 15000 });
  });

  test("login page is reachable past gate when possible", async ({ page }) => {
    await page.goto("/login");
    await enterBetaGateIfPresent(page);
    await expect(page.locator("body")).toContainText(/Sign|Log|Email|Password|Private Preview/i, {
      timeout: 15000,
    });
  });

  test("supporters page is reachable past gate when possible", async ({ page }) => {
    await page.goto("/supporters");
    await enterBetaGateIfPresent(page);
    await expect(page.locator("body")).toContainText(/Supporter|Advertise|Business|Private Preview/i, {
      timeout: 15000,
    });
  });

  test("unsubscribe page handles missing token", async ({ page }) => {
    await page.goto("/unsubscribe");
    await enterBetaGateIfPresent(page);
    await expect(page.locator("body")).toContainText(
      /unsubscribe|Account|token|digest|Weekly|Private Preview/i,
      { timeout: 15000 }
    );
  });

  test("unknown route shows not-found or beta gate", async ({ page }) => {
    await page.goto("/this-route-should-not-exist-zzz");
    await enterBetaGateIfPresent(page);
    await expect(page.locator("body")).toContainText(
      /not found|couldn't find|404|page|Private Preview/i,
      { timeout: 15000 }
    );
  });
});
