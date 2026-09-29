import { expect, test } from "@playwright/test";

test("member registers, verifies development email code, gets approved and signs in", async ({ page }) => {
  test.skip(process.env.E2E_QA_WRITE !== "1" || process.env.E2E_BASE_URL !== "http://localhost:5175", "Registration writes are restricted to isolated QA.");
  test.setTimeout(120_000);
  const suffix = String(Date.now());
  const email = `qa-registration-${suffix}@localhost.test`;
  const phone = `09${suffix.slice(-8)}`;
  const password = "QaPass-2026-Local!";

  await page.goto("/register");
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(page.locator(".field-error").filter({ hasText: "Vui lòng nhập họ và tên." })).toBeVisible();
  await page.locator("#register-name").fill(`QA Registration ${suffix}`);
  await page.locator("#register-email").fill(email);
  await page.locator("#register-phone").fill(phone);
  await page.locator("#register-password").fill(password);
  await page.locator("#register-confirm-password").fill(password);
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Xác thực email" })).toBeVisible();
  const developmentCode = await page.locator("p.auth-success code").innerText();
  expect(developmentCode).toMatch(/^\d{6}$/);
  await page.locator("#verification-code").fill(developmentCode);
  await page.getByRole("button", { name: "Xác thực mã" }).click();
  await expect(page.getByText(/chờ.*duyệt/i).first()).toBeVisible();

  await page.goto("/login");
  await page.locator("#login-email").fill("qa-receptionist@localhost.test");
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();
  await page.goto("/registrations");
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Duyệt tài khoản" }).click();
  await expect(row).toHaveCount(0);

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByText("Hội viên", { exact: true }).first()).toBeVisible();
});
