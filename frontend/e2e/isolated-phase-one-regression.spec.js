import { expect, test } from "@playwright/test";
import { isolatedQaPassword } from "./isolated-qa-password.js";

const apiOrigin = process.env.E2E_QA_API_ORIGIN;
test.use({ timezoneId: "UTC" });
test.beforeEach(() => {
  test.skip(!apiOrigin || !/^http:\/\/localhost:\d+$/.test(apiOrigin) || !/^http:\/\/localhost:\d+$/.test(process.env.E2E_BASE_URL ?? ""), "Requires an explicitly configured localhost QA stack.");
});

test("Admin recovers from a stale permission draft and saves with the refreshed version", async ({ page }) => {
  test.skip(process.env.E2E_ADMIN_PORTAL !== "1", "Requires the local Admin portal.");
  await page.goto("/login");
  await page.locator("#admin-login-email").fill("qa-admin@localhost.test");
  await page.locator("#admin-login-password").fill(isolatedQaPassword());
  await page.getByRole("button", { name: "Đăng nhập quản trị" }).click();
  await page.getByRole("button", { name: "Phân quyền chức năng", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Phân quyền chức năng" })).toBeVisible();
  const headers = { "x-sports-center-portal": "admin", origin: process.env.E2E_BASE_URL };
  const matrixUrl = `${apiOrigin}/api/v1/admin/permissions/matrix`;
  const roleUrl = `${apiOrigin}/api/v1/admin/roles/manager/permissions`;
  const original = (await (await page.request.get(matrixUrl, { headers })).json()).data;
  const originalRole = original.roles.find((role) => role.code === "manager");
  const permission = original.permissions.find((item) => item.code === "report.read");
  const checkbox = page.getByRole("checkbox", { name: `${permission.description} — manager`, exact: true });
  try {
    await checkbox.click();
    const concurrentEdit = await page.request.put(roleUrl, { headers, data: { version: originalRole.version, permissionCodes: originalRole.permissionCodes } });
    expect(concurrentEdit.ok()).toBeTruthy();
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(page.locator(".role-permissions__error")).toContainText("tải lại");
    await page.getByRole("button", { name: "Tải lại", exact: true }).click();
    await expect(checkbox).toBeChecked({ checked: originalRole.permissionCodes.includes("report.read") });
    await expect(page.getByRole("button", { name: "Lưu thay đổi", exact: true })).toBeDisabled();
    await checkbox.click();
    await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
    await expect(page.locator(".role-permissions__success")).toContainText("Đã lưu thay đổi quyền");
    const saved = (await (await page.request.get(matrixUrl, { headers })).json()).data.roles.find((role) => role.code === "manager");
    expect(saved.permissionCodes.includes("report.read")).toBe(!originalRole.permissionCodes.includes("report.read"));
  } finally {
    const latest = (await (await page.request.get(matrixUrl, { headers })).json()).data.roles.find((role) => role.code === "manager");
    const restored = await page.request.put(roleUrl, { headers, data: { version: latest.version, permissionCodes: originalRole.permissionCodes } });
    expect(restored.ok()).toBeTruthy();
  }
});

test("Reports use Vietnam boundaries and labels even in a UTC browser", async ({ page }) => {
  test.skip(process.env.E2E_ADMIN_PORTAL === "1", "Requires the local main portal.");
  await page.goto("/login");
  await page.locator("#login-email").fill("qa-manager@localhost.test");
  await page.locator("#login-password").fill(isolatedQaPassword());
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();
  await page.goto("/reports");
  await page.getByRole("button", { name: "Tùy chọn", exact: true }).click();
  await page.getByLabel("Từ ngày").fill("2026-10-02");
  const responsePromise = page.waitForResponse((response) => response.url().includes("/reports/revenue?") && response.url().includes("from=2026-10-02") && response.url().includes("to=2026-10-02"));
  await page.getByLabel("Đến ngày").fill("2026-10-02");
  const report = (await (await responsePromise).json()).data;
  expect(report.from).toBe("2026-10-01T17:00:00.000Z");
  expect(report.to).toBe("2026-10-02T16:59:59.999Z");
  await expect(page.getByText("2/10/2026 – 2/10/2026", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải CSV doanh thu" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("bao-cao-revenue.csv");
});
