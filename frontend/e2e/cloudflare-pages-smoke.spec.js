import { expect, test } from "@playwright/test";

test("Pages build serves direct public routes without missing static assets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const missingAssets = [];
  page.on("response", (response) => {
    if (response.url().startsWith(test.info().project.use.baseURL) && response.status() >= 400) missingAssets.push(`${response.status()} ${response.url()}`);
  });
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().url().includes("/auth/me")) return route.fulfill({ status: 401, json: { success: false, error: { code: "UNAUTHENTICATED" } } });
    return route.fulfill({ json: { success: true, data: [] } });
  });

  for (const [path, heading] of [
    ["/", "Đánh Thức Đam Mê Kiến Tạo Sức Khỏe"],
    ["/gallery", /không gian/i],
    ["/calendar", "Giờ trống & lịch đã đặt"],
    ["/login", "Đăng nhập"],
  ]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(missingAssets).toEqual([]);
});
