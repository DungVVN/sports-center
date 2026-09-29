import { expect, test } from "@playwright/test";

const login = async (page, role) => {
  await page.goto("/login");
  await page.locator("#login-email").fill(`qa-${role}@localhost.test`);
  await page.locator("#login-password").fill("QaPass-2026-Local!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.locator(".app-header strong")).toBeVisible();
};

test("member requests a QA court, receptionist approves, member cancels", async ({ page }) => {
  test.skip(process.env.E2E_QA_WRITE !== "1" || process.env.E2E_BASE_URL !== "http://localhost:5175", "Facility writes require isolated QA.");
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36).toUpperCase();
  const typeName = `Loại QA ${suffix}`;
  const courtName = `Sân QA ${suffix}`;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 3 * 86400000));

  await login(page, "manager");
  await page.goto("/facilities");
  const typeForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Thêm loại sân" }) });
  await typeForm.getByLabel("Tên loại sân").fill(typeName);
  await typeForm.getByRole("button", { name: "Thêm loại sân" }).click();
  await expect(page.locator(".facility-calendar__notice")).toHaveText("Đã thêm loại sân.");

  const courtForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Thêm sân" }) });
  await courtForm.getByLabel("Loại sân").selectOption({ label: typeName });
  await courtForm.getByLabel("Tên sân").fill(courtName);
  await courtForm.getByRole("button", { name: "Thêm sân" }).click();
  await expect(page.locator(".facility-calendar__notice")).toHaveText("Đã thêm sân.");

  await page.getByRole("combobox", { name: "Sân", exact: true }).selectOption({ label: courtName });
  await page.getByRole("textbox", { name: "Ngày mở" }).fill(date);
  await page.getByRole("button", { name: "Mở ngày" }).click();
  await expect(page.locator(".facility-calendar__notice")).toHaveText("Đã mở ngày đặt sân.");
  await page.getByRole("button", { name: "Đăng xuất" }).click();

  await login(page, "member");
  await page.goto("/facilities");
  const request = page.locator("form").filter({ has: page.getByRole("heading", { name: "Gửi yêu cầu đặt sân" }) });
  await request.getByLabel("Ngày và sân").selectOption({ label: `${courtName} · ${date}` });
  await request.getByLabel("Giờ bắt đầu").fill("09:00");
  await request.getByLabel("Giờ kết thúc").fill("10:00");
  await request.getByLabel("Số điện thoại").fill("0900000029");
  await request.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.locator(".facility-calendar__notice")).toContainText("Đã gửi yêu cầu");
  const mine = page.locator("section.facility-calendar__panel").filter({ has: page.getByRole("heading", { name: "Đơn đặt của tôi" }) });
  await expect(mine.locator("li").filter({ hasText: courtName })).toContainText("Chờ duyệt");
  await page.getByRole("button", { name: "Đăng xuất" }).click();

  await login(page, "receptionist");
  await page.goto("/facilities");
  const staff = page.locator("section.facility-calendar__panel").filter({ has: page.getByRole("heading", { name: "Yêu cầu đặt sân" }) });
  const reservation = staff.locator("li").filter({ hasText: courtName });
  await reservation.getByRole("button", { name: "Xử lý" }).click();
  await page.getByRole("button", { name: "Duyệt đơn" }).click();
  await expect(reservation).toContainText("Đã duyệt");
  await page.getByRole("button", { name: "Đăng xuất" }).click();

  await login(page, "member");
  await page.goto("/facilities");
  const ownReservation = page.locator("section.facility-calendar__panel").filter({ has: page.getByRole("heading", { name: "Đơn đặt của tôi" }) }).locator("li").filter({ hasText: courtName });
  await expect(ownReservation).toContainText("Đã duyệt");
  await ownReservation.getByRole("button", { name: "Hủy đơn" }).click();
  const cancelForm = page.locator("form").filter({ has: page.getByRole("heading", { name: "Hủy đơn đặt sân" }) });
  await cancelForm.getByLabel("Lý do hủy").fill("Đổi kế hoạch QA");
  await cancelForm.getByRole("button", { name: "Xác nhận hủy" }).click();
  await expect(ownReservation).toContainText("Đã hủy");
});
