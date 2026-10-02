import { expect, test } from "@playwright/test";

test("member sees classes and own facility requests together and can open the facility workspace", async ({ page }) => {
  const session = { user: { id: "schedule-member", role: "member", displayName: "Hội viên kiểm tra", mustChangePassword: false, profileSetupRequired: false }, permissions: ["booking.read", "booking.write", "class.read", "facility.booking.self.read", "facility.calendar.read"] };
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    let data = [];
    if (pathname.endsWith("/auth/me")) data = session;
    else if (pathname.endsWith("/bookings")) data = [{ id: "booking-1", booking_code: "BKG-SCHEDULE", booked_at: "2098-12-01T01:00:00Z", status: "confirmed", class_session: { id: "class-1", name: "Yoga sáng", starts_at: "2099-01-02T01:00:00Z", ends_at: "2099-01-02T02:00:00Z" } }];
    else if (pathname.endsWith("/facility-reservations/me")) data = [{ id: "field-1", facilityName: "Sân bóng", date: "2099-01-01", requestedStartMinute: 480, requestedEndMinute: 540, status: "pending" }];
    else if (pathname.endsWith("/public/facility-calendar")) data = { types: [], facilities: [], days: [] };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
  await page.goto("/bookings");
  const schedule = page.getByRole("region", { name: "Lịch sắp tới của tôi" });
  await expect(schedule.getByRole("listitem")).toHaveCount(2);
  await expect(schedule.getByRole("listitem").first()).toContainText("Sân bóng");
  await expect(schedule).toContainText("Chờ duyệt");
  await expect(schedule).toContainText("Yoga sáng");
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(schedule).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await schedule.getByRole("button", { name: "Xem đơn đặt sân" }).click();
  await expect(page).toHaveURL(/\/facilities$/);
  await expect(page.getByRole("heading", { name: "Đơn đặt của tôi" })).toBeVisible();
});
