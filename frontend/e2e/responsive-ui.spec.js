import { expect, test } from "@playwright/test";

const enabled = process.env.E2E_FULL_PRODUCTION === "1";
const password = process.env.E2E_PASSWORD;

async function signIn(page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Đăng Nhập" }).click();
  await expect(page.locator("#login-email")).toBeVisible();
  await page.locator("#login-email").fill(process.env.E2E_MEMBER_EMAIL);
  await page.locator("#login-password").fill(password);
  const response = page.waitForResponse((item) => item.url().includes("/auth/login") && item.request().method() === "POST");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole("heading", { name: /^(Hoạt động của tôi|Hồ sơ cá nhân)$/ })).toBeVisible();
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("production responsive UI", () => {
  test.skip(!enabled, "Requires E2E_FULL_PRODUCTION=1 for the deployed workspace.");

  test("keeps the member dashboard and booking navigation usable on mobile, tablet and desktop", async ({ browser }) => {
    test.setTimeout(90_000);
    test.skip(!password || !process.env.E2E_MEMBER_EMAIL, "E2E_PASSWORD and E2E_MEMBER_EMAIL are required.");

    for (const viewport of [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1440, height: 900 },
    ]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await signIn(page);
      await expectNoHorizontalOverflow(page);
      const menuToggle = page.getByRole("button", { name: "Mở menu" });
      if (await menuToggle.count()) await menuToggle.click();
      await expect(page.getByRole("button", { name: "Đặt chỗ" })).toBeVisible();
      await page.getByRole("button", { name: "Đặt chỗ" }).click();
      await expect(page.getByRole("heading", { name: "Quản lý đặt lớp" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await context.close();
    }
  });
});
