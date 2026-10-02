import { expect, test } from "@playwright/test";

test("customer enrolls in a course without a membership and pays its snapshot price", async ({ page }) => {
  const course = { id: "11111111-1111-4111-8111-111111111111", name: "Yoga 2 buổi", priceVnd: "500000", capacity: 10, status: "published", reservedSeats: 0, sessions: [{ id: "s1", name: "Yoga buổi 1", starts_at: "2099-04-01T01:00:00Z", ends_at: "2099-04-01T02:00:00Z", status: "published" }, { id: "s2", name: "Yoga buổi 2", starts_at: "2099-04-02T01:00:00Z", ends_at: "2099-04-02T02:00:00Z", status: "published" }] };
  const session = { user: { id: "customer", role: "member", displayName: "Học viên", mustChangePassword: false, profileSetupRequired: false }, permissions: ["course.read", "course.enroll", "payment.self.read", "class.read", "booking.read"] };
  let enrollments = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path.endsWith("/auth/me")) data = session;
    else if (path.endsWith("/courses")) data = [course];
    else if (path.endsWith("/course-enrollments/me")) data = enrollments;
    else if (path.endsWith("/enroll")) {
      enrollments = [{ id: "e1", course_id: course.id, course, priceVnd: "500000", status: "pending_payment" }];
      data = enrollments[0];
      course.reservedSeats = 1;
    } else if (path.endsWith("/course-enrollments/e1/payment")) {
      expect(route.request().postDataJSON()).toEqual({ method: "bank_transfer" });
      data = { id: "p1", transaction_code: "PAY-COURSE", amountVnd: "500000", status: "pending" };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });
  await page.goto("/courses");
  await expect(page.getByRole("heading", { name: "Khóa có hướng dẫn" })).toBeVisible();
  await page.getByRole("button", { name: "Đăng ký trọn khóa" }).click();
  const own = page.getByRole("region", { name: "Đăng ký khóa học" });
  await expect(own).toContainText("Chờ thanh toán");
  await own.getByRole("button", { name: "Lập thanh toán chuyển khoản" }).click();
  await expect(page.getByRole("region", { name: "Giao dịch khóa học" })).toContainText("PAY-COURSE");
  await expect(page.getByRole("region", { name: "Giao dịch khóa học" })).toContainText("500.000 đ");
  await expect(page.getByRole("button", { name: "Xem lịch học" })).toHaveCount(0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  await page.reload();
  await expect(own).toContainText("Chờ thanh toán");
  await expect(page).toHaveURL(/\/courses$/);
});
