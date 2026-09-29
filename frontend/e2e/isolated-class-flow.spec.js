import { expect, test } from "@playwright/test";
import { isolatedQaPassword } from "./isolated-qa-password.js";

test("manager creates and publishes a scheduled class in isolated QA", async ({ page }) => {
  test.skip(process.env.E2E_QA_WRITE !== "1" || process.env.E2E_BASE_URL !== "http://localhost:5175", "Writes require the isolated QA stack.");
  test.setTimeout(90_000);
  await page.goto("/login");
  await page.locator("#login-email").fill("qa-manager@localhost.test");
  await page.locator("#login-password").fill(isolatedQaPassword());
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();
  await page.goto("/classes");

  const form = page.locator("form.classes-create-form");
  await form.getByRole("button", { name: "Tạo lớp nháp" }).click();
  await expect(form.getByLabel("Tên lớp")).toBeFocused();
  const name = `Lớp QA ${Date.now().toString(36).toUpperCase()}`;
  const start = new Date();
  start.setDate(start.getDate() + 30 + Math.floor(Math.random() * 120));
  start.setHours(8 + Math.floor(Math.random() * 10), 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const localDateTime = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  await form.getByLabel("Tên lớp").fill(name);
  await form.getByLabel("Coach").selectOption({ index: 1 });
  await form.getByLabel("Phòng").selectOption({ index: 1 });
  await form.getByLabel("Bắt đầu").fill(localDateTime(start));
  await form.getByLabel("Kết thúc").fill(localDateTime(end));
  await form.getByLabel("Sức chứa").fill("10");
  await form.getByRole("button", { name: "Tạo lớp nháp" }).click();
  await page.getByRole("searchbox", { name: "Tìm ID, tên hoặc loại lớp..." }).fill(name);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row.getByText("Nháp", { exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Công bố" }).click();
  await expect(row.getByText("Đã công bố", { exact: true })).toBeVisible();
});
