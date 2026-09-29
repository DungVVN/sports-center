import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("public landing navigation", () => {
  test("opens every public destination from its visible button or link", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Đánh Thức Đam Mê Kiến Tạo Sức Khỏe" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: "Đăng Nhập" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("#login-email")).toBeVisible();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Xem lịch trống" }).click();
    await expect(page).toHaveURL(/\/calendar$/);
    await expect(page.getByRole("heading", { name: "Giờ trống & lịch đã đặt" })).toBeVisible();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tham quan phòng tập" }).click();
    await expect(page).toHaveURL(/\/gallery$/);
    await expect(page.getByRole("heading", { name: /không gian/i })).toBeVisible();

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Tạo tài khoản" }).first().click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByRole("heading", { name: /tạo tài khoản/i })).toBeVisible();
  });

  test("keeps landing links and calls to action usable on mobile, tablet and desktop", async ({ browser }) => {
    for (const viewport of [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1440, height: 900 },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expectNoHorizontalOverflow(page);
      if (viewport.width <= 768) await page.getByRole("button", { name: "Mở menu" }).click();
      const navigation = viewport.width <= 768
        ? page.locator("#mobile-public-navigation a")
        : page.locator(".navbar-links a");
      for (const link of await navigation.all()) {
        await expect(link).toBeVisible();
      }
      await context.close();
    }
  });
});
