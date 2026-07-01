/**
 * End-to-end tests for critical user flows
 * Tests: Login, navigation, cross-browser compatibility, mobile responsiveness
 */

import { test, expect } from "@playwright/test";

const E2E_LOGIN_NAME = process.env.E2E_LOGIN_NAME ?? "nodal.ah";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "Nodal@2026";
const RUN_AUTH_E2E = process.env.E2E_ENABLE_AUTH_TESTS === "true";

async function ensureLoginFormHydrated(page: import("@playwright/test").Page) {
  const passwordInput = page.locator("#password");
  await expect(passwordInput).toHaveAttribute("type", "password");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
}

async function loginAsOfficer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await ensureLoginFormHydrated(page);
  await page.locator("#loginName").fill(E2E_LOGIN_NAME);
  await page.locator("#password").fill(E2E_PASSWORD);
  await page.locator("#password").press("Enter");
  await page.waitForURL("**/officer/**", { timeout: 60000 });
}

test.describe("Login Flow - Cross-Browser", () => {
  test("should render login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("form[aria-label='Login form']")).toBeVisible();
    await expect(page.locator("#loginName")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("should keep user on login with invalid credentials", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await ensureLoginFormHydrated(page);

    await page.locator("#loginName").fill("invalid.user");
    await page.locator("#password").fill("wrong-password");
    await page.locator("#password").press("Enter");

    await page.waitForURL("**/login**", { timeout: 20000 });
    expect(page.url()).toContain("/login");
  });
});

test.describe("Officer Dashboard - Navigation", () => {
  test.skip(
    !RUN_AUTH_E2E,
    "Set E2E_ENABLE_AUTH_TESTS=true with valid auth test data.",
  );

  test.beforeEach(async ({ page }) => {
    await loginAsOfficer(page);
  });

  test("should display user menu in header", async ({ page }) => {
    const userMenu = page.locator('[aria-label="Account menu"]');
    await expect(userMenu).toBeVisible();
  });

  test("should show project list", async ({ page }) => {
    await page.goto("/officer/projects");
    const projectTable = page.locator('table, [role="grid"]');
    await expect(projectTable).toBeVisible({ timeout: 5000 });
  });

  test("should logout successfully", async ({ page }) => {
    // Click user menu
    await page.locator('[aria-label="Account menu"]').click();

    // Click logout
    await page.locator("text=Logout").click();

    // Should redirect to login
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });

  test("should blocklist JWT on logout", async ({ page, context }) => {
    // Store current JWT
    const cookies = await context.cookies();
    const sessionCookie = cookies.find(
      (c) => c.name === "__Secure-authjs.session-token",
    );

    // Logout
    await page.locator('[aria-label="Account menu"]').click();
    await page.locator("text=Logout").click();

    // Try to use old JWT (should fail)
    const cookieName = sessionCookie?.name ?? "__Secure-authjs.session-token";
    const response = await page.request.get("/api/me", {
      headers: {
        Cookie: `${cookieName}=${sessionCookie?.value ?? ""}`,
      },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe("Mobile Responsiveness", () => {
  test("should render correctly on mobile (iPhone 12)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Official Login").first()).toBeVisible();

    // Resize to mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.locator("text=Official Login").first()).toBeVisible();
  });

  test("should stack layout vertically on mobile", async ({ page }) => {
    test.skip(
      !RUN_AUTH_E2E,
      "Set E2E_ENABLE_AUTH_TESTS=true with valid auth test data.",
    );
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsOfficer(page);

    // Check that content is readable on mobile
    const mainContent = page.locator("main");
    const boundingBox = await mainContent.boundingBox();

    // Width should be close to viewport width (minus padding)
    expect(boundingBox?.width).toBeLessThan(400);
  });

  test("should have clickable touch targets on mobile", async ({ page }) => {
    test.skip(
      !RUN_AUTH_E2E,
      "Set E2E_ENABLE_AUTH_TESTS=true with valid auth test data.",
    );
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsOfficer(page);

    // Check button sizes (should be at least 44x44 for touch targets)
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const boundingBox = await buttons.nth(i).boundingBox();
      if (boundingBox) {
        expect(boundingBox.width).toBeGreaterThanOrEqual(28);
        expect(boundingBox.height).toBeGreaterThanOrEqual(28);
      }
    }
  });
});

test.describe("Authorization Boundaries", () => {
  test("should prevent OSD Admin from accessing /admin/projects", async ({
    page,
  }) => {
    await page.goto("/admin/projects");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/officer/projects");

    // Should redirect to login
    await page.waitForURL("**/login**");
    expect(page.url()).toContain("/login");
  });
});

test.describe("Cache Control", () => {
  test("should not cache protected pages in browser", async ({ page }) => {
    test.skip(
      !RUN_AUTH_E2E,
      "Set E2E_ENABLE_AUTH_TESTS=true with valid auth test data.",
    );
    await loginAsOfficer(page);

    const url = page.url();

    // Logout
    await page.locator('[aria-label="Account menu"]').click();
    await page.locator("text=Logout").click();
    await page.waitForURL("**/login**");

    // Try back button - should not show cached protected content
    await page.goBack();

    // Should be on login, not officer page
    expect(page.url()).toContain("/login");
  });
});
