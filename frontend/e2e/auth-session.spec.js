import { expect, test } from "@playwright/test";

const password = process.env.E2E_PASSWORD;
const accounts = [
  ["manager", process.env.E2E_MANAGER_EMAIL, "Quản lý trung tâm"],
  ["receptionist", process.env.E2E_RECEPTIONIST_EMAIL, "Lễ tân"],
  ["coach", process.env.E2E_COACH_EMAIL, "Huấn luyện viên"],
  ["member", process.env.E2E_MEMBER_EMAIL, "Hội viên"],
];

test.describe("production authentication", () => {
  test.skip(!password || accounts.some(([, email]) => !email), "E2E credentials cho từng role là bắt buộc cho kiểm thử đăng nhập production.");

  for (const [role, email, roleLabel] of accounts) {
    test(`${role} signs in, reaches its workspace and signs out without reload`, async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      await page.getByRole("button", { name: "Đăng Nhập" }).click();
      await expect(page.locator("#login-email")).toBeVisible();
      await page.locator("#login-email").fill(email);
      await page.locator("#login-password").fill(password);
      await page.getByRole("button", { name: "Đăng nhập" }).click();

      await expect(page.getByText(roleLabel, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Đăng xuất" }).click();
      await expect(page.locator("#login-email")).toBeVisible();
    });
  }
});
