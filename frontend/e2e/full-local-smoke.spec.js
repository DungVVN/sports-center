import { expect, test } from "@playwright/test";

const accounts = {
  ...(process.env.E2E_ADMIN_EMAIL ? { admin: process.env.E2E_ADMIN_EMAIL } : {}),
  manager: process.env.E2E_MANAGER_EMAIL,
  receptionist: process.env.E2E_RECEPTIONIST_EMAIL,
  coach: process.env.E2E_COACH_EMAIL,
  member: process.env.E2E_MEMBER_EMAIL,
};

const routes = {
  admin: [
    ["Tổng quan", "/dashboard"], ["Hồ sơ", "/profile"], ["Phân quyền chức năng", "/admin/permissions"],
    ["Hội viên", "/members"], ["Duyệt đăng ký", "/registrations"],
    ["Tạo gói tập", "/packages/create"], ["Danh mục gói", "/packages/catalog"],
    ["Gán gói hội viên", "/memberships/assign"], ["Lớp học", "/classes"],
    ["Đặt chỗ", "/bookings"], ["Lịch sân", "/facilities"], ["Điểm danh", "/attendance"],
    ["Thanh toán", "/payments"], ["Danh tính & nhân sự", "/staff"],
    ["Giáo án", "/training"], ["Báo cáo", "/reports"],
    ["Nhật kí hoạt động", "/audit-logs"], ["Hỗ trợ", "/support"],
  ],
  manager: [
    ["Tổng quan", "/dashboard"], ["Hồ sơ", "/profile"], ["Hội viên", "/members"],
    ["Duyệt đăng ký", "/registrations"], ["Tạo gói tập", "/packages/create"],
    ["Danh mục gói", "/packages/catalog"], ["Gán gói hội viên", "/memberships/assign"],
    ["Lớp học", "/classes"], ["Đặt chỗ", "/bookings"], ["Lịch sân", "/facilities"],
    ["Điểm danh", "/attendance"], ["Thanh toán", "/payments"],
    ["Danh tính & nhân sự", "/staff"], ["Giáo án", "/training"],
    ["Báo cáo", "/reports"], ["Nhật kí hoạt động", "/audit-logs"], ["Hỗ trợ", "/support"],
  ],
  receptionist: [
    ["Tổng quan", "/dashboard"], ["Hồ sơ", "/profile"], ["Hội viên", "/members"],
    ["Duyệt đăng ký", "/registrations"], ["Tạo gói tập", "/packages/create"],
    ["Danh mục gói", "/packages/catalog"], ["Gán gói hội viên", "/memberships/assign"],
    ["Lớp học", "/classes"], ["Đặt chỗ", "/bookings"], ["Lịch sân", "/facilities"],
    ["Điểm danh", "/attendance"], ["Thanh toán", "/payments"], ["Hỗ trợ", "/support"],
  ],
  coach: [
    ["Tổng quan", "/dashboard"], ["Hồ sơ", "/profile"], ["Hội viên", "/members"],
    ["Lớp học", "/classes"], ["Đặt chỗ", "/bookings"], ["Lịch sân", "/facilities"],
    ["Điểm danh", "/attendance"], ["Giáo án", "/training"],
  ],
  member: [
    ["Tổng quan", "/dashboard"], ["Hồ sơ", "/profile"], ["Danh mục gói", "/packages/catalog"],
    ["Lớp học", "/classes"], ["Đặt chỗ", "/bookings"], ["Lịch sân", "/facilities"],
    ["Hỗ trợ", "/support"], ["Gói tập của tôi", "/my/memberships"],
    ["Điểm danh của tôi", "/my/attendance"], ["Giáo án của tôi", "/my/training"],
    ["Thanh toán của tôi", "/my/payments"],
  ],
};

async function clickNavigation(page, label, mobile) {
  if (mobile) await page.getByRole("button", { name: "Mở menu" }).click();
  const nav = mobile ? page.locator("#mobile-navigation nav") : page.locator(".app-sidebar nav");
  const target = nav.getByRole("button", { name: label, exact: true });
  if (!(await target.isVisible().catch(() => false))) {
    for (const group of await nav.locator('button[aria-expanded="false"]').all()) {
      await group.click();
      if (await target.isVisible().catch(() => false)) break;
    }
  }
  if (process.env.E2E_QA_ISOLATED === "1" && !(await target.count())) {
    if (mobile) await page.locator("#mobile-navigation .app-mobile-nav__heading button").click();
    return false;
  }
  await expect(target).toBeVisible();
  await target.click();
  return true;
}

test.describe("full local navigation matrix", () => {
  test.skip(process.env.E2E_LOCAL_FULL !== "1", "Run only against the approved local application.");
  test.skip(!process.env.E2E_PASSWORD || Object.values(accounts).some((email) => !email), "Test accounts are required.");

  for (const [role, email] of Object.entries(accounts)) {
    for (const viewport of [
      { name: "mobile", width: 390, height: 844 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1440, height: 900 },
    ]) {
      test(`${role} can navigate every permitted page on ${viewport.name}`, async ({ browser }) => {
        test.setTimeout(300_000);
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));
        await page.goto("/login", { waitUntil: "domcontentloaded" });
        await page.locator("#login-email").fill(email);
        await page.locator("#login-password").fill(process.env.E2E_PASSWORD);
        await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
        await expect(page.locator(".app-header strong")).toBeVisible();

        for (const [label, path] of routes[role]) {
          await test.step(`${label} → ${path}`, async () => {
            const present = await clickNavigation(page, label, viewport.width < 768);
            if (!present) {
              test.info().annotations.push({ type: "permission-skipped", description: `${role}: ${label}` });
              return;
            }
            await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
            await expect(page.locator("main h1").first()).toBeVisible();
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            const unnamedControls = await page.evaluate(() => [...document.querySelectorAll("button, a[href]")]
              .filter((element) => element.getClientRects().length && getComputedStyle(element).visibility !== "hidden")
              .filter((element) => !(element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.getAttribute("title") || element.innerText.trim()))
              .map((element) => element.outerHTML.slice(0, 160)));
            expect(unnamedControls).toEqual([]);
          });
        }
        expect(pageErrors).toEqual([]);
        await context.close();
      });
    }
  }
});
