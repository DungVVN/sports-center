import { expect, test } from "@playwright/test";
import { isolatedQaPassword } from "./isolated-qa-password.js";

test("member deep links, browser history and reload preserve the authorized workspace", async ({ page }) => {
  test.skip(process.env.E2E_BASE_URL !== "http://localhost:5175" || process.env.E2E_LOCAL_FULL !== "1", "Requires the isolated local member portal.");
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#login-email").fill("qa-member@localhost.test");
  await page.locator("#login-password").fill(isolatedQaPassword());
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();

  await page.goto("/bookings", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page).toHaveURL(/\/bookings$/);
  await page.locator(".app-sidebar nav").getByRole("button", { name: "Lớp học", exact: true }).click();
  await expect(page).toHaveURL(/\/classes$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/bookings$/);
  await expect(page.locator("main h1").first()).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/classes$/);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page).toHaveURL(/\/classes$/);
});
