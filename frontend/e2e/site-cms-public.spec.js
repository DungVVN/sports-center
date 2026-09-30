import { expect, test } from "@playwright/test";

const success = (data) => ({ success: true, data });

test("published static page renders with safe fallback navigation on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/auth/me")) return route.fulfill({ status: 401, json: { success: false, error: { code: "AUTHENTICATION_REQUIRED" } } });
    if (url.pathname.endsWith("/site/page") && url.searchParams.get("path") === "/gioi-thieu") {
      return route.fulfill({ json: success({ path: "/gioi-thieu", kind: "static", title: "Giới thiệu", seoTitle: "Giới thiệu Kinetic", blocks: [{ id: "hero", type: "hero", active: true, title: "Cộng đồng thể thao Kinetic", description: "Tập luyện mỗi ngày." }] }) });
    }
    if (url.pathname.includes("/site/menus/")) return route.fulfill({ status: 404, json: { success: false, error: { code: "NOT_FOUND" } } });
    return route.fulfill({ status: 404, json: { success: false, error: { code: "NOT_FOUND" } } });
  });

  await page.goto("/gioi-thieu", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Cộng đồng thể thao Kinetic" })).toBeVisible();
  await expect(page).toHaveTitle("Giới thiệu Kinetic");
  await page.getByRole("button", { name: "Mở menu" }).click();
  await expect(page.locator("#mobile-public-navigation a[href='/gallery']")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
