import { expect, test } from "@playwright/test";
import { isolatedQaPassword } from "./isolated-qa-password.js";

test("receptionist records a dummy cash receipt and activates a QA membership", async ({ page }) => {
  test.skip(process.env.E2E_QA_WRITE !== "1" || process.env.E2E_BASE_URL !== "http://localhost:5175", "Financial simulation is restricted to isolated QA.");
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.locator("#login-email").fill("qa-receptionist@localhost.test");
  await page.locator("#login-password").fill(isolatedQaPassword());
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();
  await page.goto("/payments");
  const form = page.locator("form.members-form--payment-create");
  await form.getByRole("button", { name: "Lập phiếu thu" }).click();
  await expect(form.getByText("Vui lòng chọn hội viên.")).toBeVisible();
  const memberSelect = form.getByLabel("Hội viên", { exact: true });
  const memberOption = memberSelect.locator("option").filter({ hasText: "MEM-QA-0029" });
  await memberSelect.selectOption(await memberOption.getAttribute("value"));
  const membershipSelect = form.getByLabel("Gói chờ thanh toán");
  await expect.poll(() => membershipSelect.locator("option").count()).toBeGreaterThan(1);
  await membershipSelect.selectOption({ index: 1 });
  await expect(form.getByLabel("Số tiền (VNĐ)")).not.toHaveValue("");
  await form.getByRole("button", { name: "Lập phiếu thu" }).click();
  const pendingRow = page.getByRole("row").filter({ hasText: "QA Member" }).filter({ hasText: "Chờ xác nhận" }).first();
  await expect(pendingRow).toBeVisible();
  await pendingRow.getByRole("button", { name: "Xác nhận đã thu" }).click();
  await expect(page.locator("p.auth-success").filter({ hasText: "Đã xác nhận thanh toán và kích hoạt gói tập." })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "QA Member" }).filter({ hasText: "Đã thanh toán" }).first()).toBeVisible();
});
