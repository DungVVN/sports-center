import { expect, test } from "@playwright/test";

for (const [name, width, height] of [["desktop", 1440, 900], ["tablet", 900, 900], ["mobile", 390, 844]]) {
  test(`grouped sidebar exposes distinct icons and navigates on ${name}`, async ({ page }) => {
    test.skip(process.env.E2E_ADMIN_PORTAL !== "1", "Admin navigation requires the admin portal.");
    await page.setViewportSize({ width, height });
    await page.route("**/api/v1/**", (route) => {
      const { pathname } = new URL(route.request().url());
      const data = pathname.endsWith("/auth/me")
        ? { user: { id: "navigation-admin", role: "admin", displayName: "Navigation QA", mustChangePassword: false, profileSetupRequired: false }, permissions: [] }
        : [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
    });
    await page.goto("/members");
    if (width < 768) await page.getByRole("button", { name: "Mở menu" }).click();
    const nav = width < 768 ? page.locator("#mobile-navigation nav") : page.locator(".app-sidebar nav");
    const groups = ["Website", "Quản lý hội viên", "Gói tập", "Lịch & hoạt động", "Nhân sự & phân quyền", "Báo cáo & nhật kí"];
    for (const label of groups) {
      await expect(nav.getByRole("button", { name: new RegExp(`^${label.replaceAll("&", "\\&")},`) })).toBeVisible();
    }
    await expect(nav.getByRole("button", { name: "Hội viên", exact: true })).toHaveAttribute("aria-current", "page");
    if (name === "desktop") await page.locator(".app-sidebar").screenshot({ path: "../qa-evidence/sidebar-grouped-desktop.png" });
    await nav.getByRole("button", { name: "Quản lý hội viên, thu gọn" }).click();
    await expect(nav.getByRole("button", { name: "Hội viên", exact: true })).toHaveCount(0);
    for (const label of groups) {
      await nav.getByRole("button", { name: `${label}, mở rộng`, exact: true }).click();
    }
    const icons = await nav.locator("button").evaluateAll((buttons) => buttons.map((button) => button.querySelector("svg")?.getAttribute("class")));
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
    // Fold other groups before selecting from a tablet flyout.
    for (const label of groups.filter((label) => label !== "Lịch & hoạt động")) {
      await nav.getByRole("button", { name: `${label}, thu gọn`, exact: true }).click();
    }
    const destination = nav.getByRole("button", { name: "Đặt chỗ", exact: true });
    const box = await destination.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await destination.click();
    await expect(page).toHaveURL(/\/bookings$/);
    if (width < 768) await expect(page.locator("#mobile-navigation")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
