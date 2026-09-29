import { expect, test } from "@playwright/test";

test("member booking action aligns with the class picker on wide screens", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    let data = [];
    if (pathname.endsWith("/auth/me")) {
      data = { user: { id: "layout-member", role: "member", displayName: "Hội viên kiểm tra", mustChangePassword: false, profileSetupRequired: false }, permissions: ["booking.read", "booking.write"] };
    } else if (pathname.endsWith("/classes")) {
      data = [{ id: "layout-class", name: "Lớp kiểm tra", status: "published", starts_at: "2099-01-01T09:00:00.000Z" }];
    } else if (pathname.endsWith("/bookings")) {
      data = [{ id: "layout-booking", booking_code: "BKG-LAYOUT", status: "cancelled", class_session: { name: "Lớp kiểm tra" }, booked_at: "2026-09-29T09:00:00.000Z" }];
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });

  await page.goto("/bookings");
  await expect(page.getByRole("heading", { name: "Đặt chỗ lớp học" })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "BKG-LAYOUT" }).locator("td").last()).toHaveText("—");

  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const picker = await page.locator(".class-session-select__trigger").boundingBox();
    const action = await page.locator(".members-form--booking-create-member").getByRole("button", { name: "Đặt chỗ" }).boundingBox();
    expect(picker).not.toBeNull();
    expect(action).not.toBeNull();
    if (width >= 768) {
      expect(Math.abs(picker.y + picker.height - action.y - action.height)).toBeLessThanOrEqual(1);
    } else {
      expect(action.y).toBeGreaterThan(picker.y + picker.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
