import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("manager exports both local reports and validates a custom date range", async ({ page }) => {
  test.skip(process.env.E2E_LOCAL_FULL !== "1" || !process.env.E2E_MANAGER_EMAIL || !process.env.E2E_PASSWORD, "Local manager account required.");
  await page.goto("/login");
  await page.locator("#login-email").fill(process.env.E2E_MANAGER_EMAIL);
  await page.locator("#login-password").fill(process.env.E2E_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Doanh thu và điểm danh" })).toBeVisible();

  for (const [label, filename] of [["Tải CSV doanh thu", "bao-cao-revenue.csv"], ["Tải CSV điểm danh", "bao-cao-attendance.csv"]]) {
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: label }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(filename);
    const contents = await readFile(await download.path(), "utf8");
    expect(contents.length).toBeGreaterThan(10);
  }

  await page.getByRole("button", { name: "Tùy chọn" }).click();
  await expect(page.getByRole("button", { name: "Tải CSV doanh thu" })).toBeDisabled();
  await page.getByLabel("Từ ngày").fill("2026-09-29");
  await page.getByLabel("Đến ngày").fill("2026-09-01");
  await expect(page.getByRole("alert")).toContainText("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
  await expect(page.getByRole("button", { name: "Tải CSV doanh thu" })).toBeDisabled();
  await page.getByLabel("Đến ngày").fill("2026-09-29");
  await expect(page.getByRole("button", { name: "Tải CSV doanh thu" })).toBeEnabled();
});
