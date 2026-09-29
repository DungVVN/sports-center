import { expect, test } from "@playwright/test";

test("member ticket reaches receptionist, receives a reply and returns to member", async ({ page }) => {
  test.skip(process.env.E2E_QA_WRITE !== "1" || process.env.E2E_BASE_URL !== "http://localhost:5175", "Support writes require isolated QA.");
  test.setTimeout(90_000);
  const subject = `QA hỗ trợ ${Date.now().toString(36).toUpperCase()}`;
  const response = `Phản hồi QA cho ${subject}`;
  const login = async (email) => {
    await page.goto("/login");
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill("QaPass-2026-Local!");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page.locator(".app-header strong")).toBeVisible();
  };

  await login("qa-member@localhost.test");
  await page.goto("/support");
  const form = page.locator("form.members-form");
  await form.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(form.getByLabel("Tiêu đề")).toBeFocused();
  await form.getByLabel("Tiêu đề").fill(subject);
  await form.getByLabel("Nội dung").fill("Kiểm thử vòng trao đổi hỗ trợ trên cơ sở dữ liệu QA.");
  await form.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(page.getByText(subject).first()).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();

  await login("qa-receptionist@localhost.test");
  await page.goto("/support");
  const ticket = page.locator("article").filter({ hasText: subject }).first();
  await expect(ticket).toBeVisible();
  await ticket.getByRole("button", { name: "Xử lý" }).click();
  await page.getByRole("button", { name: "Nhận phụ trách" }).click();
  const replyForm = page.locator("form.members-form");
  await replyForm.getByLabel("Phản hồi").fill(response);
  await replyForm.getByLabel("Trạng thái mới").selectOption("resolved");
  await replyForm.getByRole("button", { name: "Gửi phản hồi" }).click();
  await expect(page.getByText(response)).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất" }).click();

  await login("qa-member@localhost.test");
  await page.goto("/support");
  const memberTicket = page.locator("article").filter({ hasText: subject }).first();
  await memberTicket.getByRole("button", { name: "Xem trao đổi" }).click();
  await expect(page.getByText(response)).toBeVisible();
});
