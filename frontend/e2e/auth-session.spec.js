import { expect, test } from "@playwright/test";

const password = process.env.E2E_PASSWORD ?? process.env.DEMO_ACCOUNT_PASSWORD;
const accounts = [
  ["manager", process.env.E2E_MANAGER_EMAIL ?? "manager01@sportscenter.local", "Quản lý trung tâm"],
  ["receptionist", process.env.E2E_RECEPTIONIST_EMAIL ?? "reception01@sportscenter.local", "Lễ tân"],
  ["coach", process.env.E2E_COACH_EMAIL ?? "coach01@sportscenter.local", "Huấn luyện viên"],
  ["member", process.env.E2E_MEMBER_EMAIL ?? "member01@sportscenter.local", "Hội viên"],
];

test.describe("production authentication", () => {
  test.skip(!password, "E2E_PASSWORD hoặc DEMO_ACCOUNT_PASSWORD là bắt buộc cho kiểm thử đăng nhập production.");

  for (const [role, email, roleLabel] of accounts) {
    test(`${role} signs in, reaches its workspace and signs out without reload`, async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      await page.locator("#login-email").fill(email);
      await page.locator("#login-password").fill(password);
      await page.getByRole("button", { name: "Đăng nhập" }).click();

      await expect(page.getByText(roleLabel, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Đăng xuất" }).click();
      await expect(page.locator("#login-email")).toBeVisible();
    });
  }
});
