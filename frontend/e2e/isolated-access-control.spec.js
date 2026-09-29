import { expect, test } from "@playwright/test";
import { isolatedQaPassword } from "./isolated-qa-password.js";

test("member cannot open staff-only workspaces by typing their URLs", async ({ page }) => {
  test.skip(process.env.E2E_BASE_URL !== "http://localhost:5175", "Requires the isolated local QA stack.");
  await page.goto("/login");
  await page.locator("#login-email").fill("qa-member@localhost.test");
  await page.locator("#login-password").fill(isolatedQaPassword());
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();

  for (const forbidden of ["/staff", "/payments", "/audit-logs", "/memberships/assign", "/admin/permissions"]) {
    await page.goto(forbidden);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Hoạt động của tôi" })).toBeVisible();
  }
});
