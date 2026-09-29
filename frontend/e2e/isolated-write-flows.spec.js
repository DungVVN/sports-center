import { expect, test } from "@playwright/test";

test("manager creates a package and assigns it to a member in the isolated database", async ({ page }) => {
  test.skip(process.env.E2E_QA_WRITE !== "1" || process.env.E2E_BASE_URL !== "http://localhost:5175", "Writes are restricted to the isolated QA stack.");
  test.setTimeout(120_000);

  await page.goto("/login");
  await page.locator("#login-email").fill("qa-manager@localhost.test");
  await page.locator("#login-password").fill("QaPass-2026-Local!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();

  const code = `QA${Date.now().toString(36).toUpperCase()}`;
  const name = `Gói QA ${code}`;
  const tierRank = String(Math.floor(Math.random() * 1_000_000_000) + 1);
  await page.goto("/packages/create");
  const packageForm = page.locator("form.package-create-form");
  await packageForm.getByRole("button", { name: "Tạo gói", exact: true }).click();
  await expect(packageForm.getByText("Vui lòng nhập mã gói.")).toBeVisible();
  await packageForm.getByLabel("Mã gói").fill(code);
  await packageForm.getByLabel("Tên gói").fill(name);
  await packageForm.getByLabel("Giá (VNĐ)").fill("100000");
  await packageForm.getByLabel("Số ngày").fill("30");
  await packageForm.getByLabel("Thứ hạng quyền").fill(tierRank);
  await packageForm.getByLabel("Tập gym").check();
  await packageForm.getByLabel("Đặt lớp nhóm").check();
  await packageForm.getByRole("button", { name: "Tạo gói", exact: true }).click();
  await expect(page.locator("p.auth-success").filter({ hasText: "Đã tạo gói tập." })).toBeVisible();

  await page.goto("/packages/catalog");
  await page.getByRole("searchbox", { name: "Tìm tên hoặc mã gói..." }).fill(code);
  await expect(page.getByText(name, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.locator("#login-email").fill("qa-receptionist@localhost.test");
  await page.locator("#login-password").fill("QaPass-2026-Local!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();

  await page.goto("/memberships/assign");
  const assignment = page.locator("form.members-form").filter({ has: page.getByRole("heading", { name: "Tạo gói cho hội viên" }) });
  await assignment.getByRole("button", { name: "Tạo gói cho hội viên" }).click();
  await expect(assignment.getByText("Vui lòng chọn hội viên.")).toBeVisible();
  const memberSelect = assignment.locator("select").nth(0);
  const memberOption = memberSelect.locator("option").filter({ hasText: "QA Member" });
  await memberSelect.selectOption(await memberOption.getAttribute("value"));
  const packageSelect = assignment.locator("select").nth(1);
  const packageOption = packageSelect.locator("option").filter({ hasText: name });
  await expect(packageOption).toHaveCount(1, { timeout: 5_000 });
  await packageSelect.selectOption(await packageOption.getAttribute("value"));
  await assignment.getByRole("button", { name: "Tạo gói cho hội viên" }).click();
  await expect(page.locator("p.auth-success").filter({ hasText: "Đã tạo gói chờ thanh toán" })).toBeVisible();
});

test("membership assignment remains usable after selecting data on mobile", async ({ browser }) => {
  test.skip(process.env.E2E_QA_WRITE !== "1" || process.env.E2E_BASE_URL !== "http://localhost:5175", "Runs only on the isolated QA stack.");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#login-email").fill("qa-receptionist@localhost.test");
  await page.locator("#login-password").fill("QaPass-2026-Local!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();
  await page.goto("/memberships/assign");
  const assignment = page.locator("form.members-form").filter({ has: page.getByRole("heading", { name: "Tạo gói cho hội viên" }) });
  const memberSelect = assignment.locator("select").nth(0);
  const qaMember = memberSelect.locator("option").filter({ hasText: "MEM-QA-0029" });
  await memberSelect.selectOption(await qaMember.getAttribute("value"));
  await assignment.locator("select").nth(1).selectOption({ index: 1 });
  await expect(page.locator(".selected-member-summary strong").first()).toHaveText("QA Member");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});
