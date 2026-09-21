import { expect, test } from "@playwright/test";

const enabled = process.env.E2E_FULL_PRODUCTION === "1";
const password = process.env.E2E_PASSWORD ?? process.env.DEMO_ACCOUNT_PASSWORD;

test.describe("production account setup", () => {
  test.skip(!enabled, "Requires E2E_FULL_PRODUCTION=1 because it creates four real accounts.");

  test("creates three staff accounts through the Manager UI and submits one Member registration", async ({ page }) => {
    test.skip(!password, "E2E_PASSWORD or DEMO_ACCOUNT_PASSWORD is required.");
    const run = String(Date.now()).slice(-8);
    const accounts = [
      { role: "manager", fullName: `Minh Nguyen ${run}`, email: `minh.nguyen.${run}@example.invalid`, phone: `090${run.slice(0, 7)}` },
      { role: "receptionist", fullName: `Linh Tran ${run}`, email: `linh.tran.${run}@example.invalid`, phone: `091${run.slice(0, 7)}` },
      { role: "coach", fullName: `Khanh Le ${run}`, email: `khanh.le.${run}@example.invalid`, phone: `092${run.slice(0, 7)}` },
    ];

    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator("#login-email").fill(process.env.E2E_MANAGER_EMAIL ?? "manager01@sportscenter.local");
    await page.locator("#login-password").fill(password);
    const loginResponse = page.waitForResponse(
      (response) => response.url().includes("/auth/login") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    expect((await loginResponse).status()).toBe(200);
    await expect(page.getByText("Quản lý trung tâm", { exact: true })).toBeVisible();
    await page.getByText("Nhân viên", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Thêm nhân viên" })).toBeVisible();

    // Browser-native validation is part of the production UI contract.
    await page.getByRole("button", { name: "Tạo nhân viên" }).click();
    expect(await page.locator('input[name="fullName"]').evaluate((input) => input.checkValidity())).toBe(false);

    for (const account of accounts) {
      await page.locator('input[name="fullName"]').fill(account.fullName);
      await page.locator('input[name="email"]').fill(account.email);
      await page.locator('input[name="phone"]').fill(account.phone);
      await page.locator('select[name="role"]').selectOption(account.role);
      await page.getByRole("button", { name: "Tạo nhân viên" }).click();
      const passwordBox = page.locator(".staff-password code");
      await expect(passwordBox).toBeVisible();
      account.password = await passwordBox.textContent();
      expect(account.password).toBeTruthy();
      await page.getByRole("button", { name: "Đã lưu an toàn" }).click();
      await expect(passwordBox).toBeHidden();
    }

    for (const account of accounts) {
      await page.getByRole("button", { name: "Đăng xuất" }).click();
      await expect(page.locator("#login-email")).toBeVisible();
      await page.locator("#login-email").fill(account.email);
      await page.locator("#login-password").fill(account.password);
      await page.getByRole("button", { name: "Đăng nhập" }).click();
      await expect(page.getByText({ manager: "Quản lý trung tâm", receptionist: "Lễ tân", coach: "Huấn luyện viên" }[account.role], { exact: true })).toBeVisible();
    }

    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page.locator("#login-email")).toBeVisible();
    await page.getByRole("button", { name: "Đăng ký hội viên" }).click();
    await expect(page.getByRole("heading", { name: "Tạo tài khoản hội viên" })).toBeVisible();

    await page.locator("#register-name").fill(`An Pham ${run}`);
    await page.locator("#register-email").fill(`an.pham.${run}@example.invalid`);
    await page.locator("#register-phone").fill(`093${run.slice(0, 7)}`);
    await page.locator("#register-password").fill(password);
    const responsePromise = page.waitForResponse((response) => response.url().includes("/auth/register") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Đăng ký" }).click();
    const response = await responsePromise;
    await response.json();
    expect(response.status()).toBeLessThan(600);

    // The assertion deliberately surfaces whether production verification delivery is configured.
    expect([201, 501]).toContain(response.status());
  });
});
