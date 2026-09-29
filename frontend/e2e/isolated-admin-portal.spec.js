import { expect, test } from "@playwright/test";
import { isolatedQaPassword } from "./isolated-qa-password.js";

test.describe("isolated Admin portal", () => {
  test.skip(process.env.E2E_ADMIN_PORTAL !== "1" || process.env.E2E_BASE_URL !== "http://localhost:5175", "Requires the isolated local Admin portal.");

  test("admits Admin, preserves the workspace, and rejects a Manager", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Cổng quản trị hệ thống" })).toBeVisible();
    await page.locator("#admin-login-email").fill("qa-manager@localhost.test");
    await page.locator("#admin-login-password").fill(isolatedQaPassword());
    await page.getByRole("button", { name: "Đăng nhập quản trị" }).click();
    await expect(page.locator("p.auth-alert")).toContainText("Quản trị hệ thống");

    await page.locator("#admin-login-email").fill("qa-admin@localhost.test");
    await page.locator("#admin-login-password").fill(isolatedQaPassword());
    await page.getByRole("button", { name: "Đăng nhập quản trị" }).click();
    await expect(page.locator(".app-header strong")).toBeVisible();
    await page.getByRole("button", { name: "Phân quyền chức năng" }).click();
    await expect(page.locator("main h1").first()).toBeVisible();
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page.getByRole("heading", { name: "Cổng quản trị hệ thống" })).toBeVisible();
  });
});
