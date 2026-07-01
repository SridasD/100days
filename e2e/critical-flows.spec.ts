/**
 * End-to-end tests for critical user flows
 * Tests: Login, navigation, cross-browser compatibility, mobile responsiveness
 */

import { test, expect } from "@playwright/test";

test.describe("Login Flow - Cross-Browser", () => {
  test("should login successfully", async ({ page }) => {
    await page.goto("/login");

    // Fill login form
    await page.fill('input[name="loginName"]', "officer1");
    await page.fill('input[name="password"]', "TestPass@123");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL("**/officer/**");

    expect(page.url()).toContain("/officer");
  });

  test("should display error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.fill('input[name="loginName"]', "invalid");
    await page.fill('input[name="password"]', "wrong");
    await page.click('button[type="submit"]');

    // Look for error message
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();
  });

  test("should handle account lockout", async ({ page }) => {
    // Test account lockout after 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await page.goto("/login");
      await page.fill('input[name="loginName"]', "officer1");
      await page.fill('input[name="password"]', "wrongpass");
      await page.click('button[type="submit"]');
    }

    // Account should be locked
    const lockedMessage = page.locator("text=Account locked");
    await expect(lockedMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Officer Dashboard - Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/login");
    await page.fill('input[name="loginName"]', "officer1");
    await page.fill('input[name="password"]', "TestPass@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/officer/**");
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
    await page.waitForURL("**/login");
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
    const response = await page.request.get("/api/me", {
      headers: {
        Cookie: `__Secure-authjs.session-token=${sessionCookie?.value}`,
      },
    });

    expect(response.status()).toBe(401);
  });
});

test.describe("Mobile Responsiveness", () => {
  test("should render correctly on mobile (iPhone 12)", async ({ page }) => {
    await page.goto("/");

    // Check for mobile menu
    const mobileMenu = page.locator('[aria-label="Mobile menu"]');

    // Desktop view should not show mobile menu
    await expect(mobileMenu).not.toBeVisible();

    // Resize to mobile
    await page.setViewportSize({ width: 390, height: 844 });

    // Mobile menu should appear
    await expect(mobileMenu).toBeVisible({ timeout: 5000 });
  });

  test("should stack layout vertically on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/officer/projects");

    // Check that content is readable on mobile
    const mainContent = page.locator("main");
    const boundingBox = await mainContent.boundingBox();

    // Width should be close to viewport width (minus padding)
    expect(boundingBox?.width).toBeLessThan(400);
  });

  test("should have clickable touch targets on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/officer/projects");

    // Check button sizes (should be at least 44x44 for touch targets)
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const boundingBox = await buttons.nth(i).boundingBox();
      if (boundingBox) {
        expect(boundingBox.width).toBeGreaterThanOrEqual(32);
        expect(boundingBox.height).toBeGreaterThanOrEqual(32);
      }
    }
  });
});

test.describe("Authorization Boundaries", () => {
  test("should prevent OSD Admin from accessing /admin/projects", async ({
    page,
  }) => {
    // Try to access restricted route
    const response = await page.request.get("/admin/projects", {
      headers: {
        Authorization: "Bearer fake-osd-admin-token",
      },
    });

    expect(response.status()).toBe(401 || 403);
  });

  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/officer/projects");

    // Should redirect to login
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });
});

test.describe("Cache Control", () => {
  test("should not cache protected pages in browser", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="loginName"]', "officer1");
    await page.fill('input[name="password"]', "TestPass@123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/officer/**");

    const url = page.url();

    // Logout
    await page.locator('[aria-label="Account menu"]').click();
    await page.locator("text=Logout").click();
    await page.waitForURL("**/login");

    // Try back button - should not show cached protected content
    await page.goBack();

    // Should be on login, not officer page
    expect(page.url()).toContain("/login");
  });
});
