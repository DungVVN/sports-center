import { expect, test } from "@playwright/test";

test("AI review suggestions stay compact across wide and narrow layouts", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    let data = [];
    if (pathname.endsWith("/auth/me")) {
      data = { user: { id: "layout-coach", role: "coach", displayName: "Coach kiểm tra", mustChangePassword: false, profileSetupRequired: false }, permissions: ["training.write", "ai.assist.read", "ai.assist.deliver"] };
    } else if (pathname.endsWith("/ai-assist/suggestions")) {
      const titles = ["QA Waitlist 30-09", "QA Notification Scope 2909", "QA Concurrent 2909", "QA Freeze Access 0410"];
      data = [{ suggestions: titles.map((title, index) => ({ subject: `Nhắc lịch lớp ${title}`, body: `Kiểm tra danh sách hội viên trước buổi 08:00:00 ${index + 1}/10/2026.` })) }];
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });

  await page.goto("/training");
  const items = page.locator(".ai-review__grid > .ai-review__item");
  await expect(items).toHaveCount(4);
  await expect(items.first().getByRole("button", { name: "Rà soát và gửi" })).toBeVisible();

  for (const width of [1920, 1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const first = await items.nth(0).boundingBox();
    const second = await items.nth(1).boundingBox();
    const fourth = await items.nth(3).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(fourth).not.toBeNull();
    if (width === 1920) {
      expect(Math.abs(first.y - fourth.y)).toBeLessThanOrEqual(1);
      expect(first.width).toBeLessThan(500);
      expect(first.height).toBeLessThan(320);
    } else if (width === 1440) {
      expect(Math.abs(first.y - second.y)).toBeLessThanOrEqual(1);
      expect(second.x).toBeGreaterThan(first.x + first.width);
      expect(fourth.y).toBeGreaterThan(first.y + first.height);
    } else {
      expect(second.y).toBeGreaterThan(first.y + first.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
