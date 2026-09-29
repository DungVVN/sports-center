import { expect, test } from "@playwright/test";

const accounts = [
  { role: "manager", email: process.env.E2E_MANAGER_EMAIL, memberResetStatus: 403 },
  { role: "receptionist", email: process.env.E2E_RECEPTIONIST_EMAIL, memberResetStatus: 422 },
  { role: "coach", email: process.env.E2E_COACH_EMAIL, memberResetStatus: 403 },
  { role: "member", email: process.env.E2E_MEMBER_EMAIL, memberResetStatus: 403 },
];

test("local credential permissions deny unauthorized roles before ID validation", async ({ browser }) => {
  test.skip(process.env.E2E_LOCAL_FULL !== "1", "Only run against the approved local API.");
  test.skip(!process.env.E2E_PASSWORD || accounts.some(({ email }) => !email), "QA accounts are required.");

  for (const { role, email, memberResetStatus } of accounts) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto("/login");
      await page.locator("#login-email").fill(email);
      await page.locator("#login-password").fill(process.env.E2E_PASSWORD);
      await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
      await expect(page.locator(".app-header strong")).toBeVisible();

      // An invalid ID guarantees this authorization probe cannot reset a real account.
      const memberReset = await page.request.post("http://localhost:8880/api/v1/members/not-a-uuid/account-credentials");
      expect(memberReset.status(), `${role} member reset`).toBe(memberResetStatus);

      const staffReset = await page.request.post("http://localhost:8880/api/v1/staff/not-a-uuid/account-credentials");
      expect(staffReset.status(), `${role} staff reset`).toBe(403);
    } finally {
      await context.close();
    }
  }
});
