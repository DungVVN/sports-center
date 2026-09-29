import { expect, test } from "@playwright/test";

test("expanded Authenticator aligns with the security cards without hiding the QR or confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    let data = {};
    if (pathname.endsWith("/auth/me")) {
      data = { user: { id: "layout-member", role: "member", displayName: "Hội viên kiểm tra", mustChangePassword: false, profileSetupRequired: false }, permissions: ["notification.preference.manage"] };
    } else if (pathname.endsWith("/auth/profile")) {
      data = { id: "layout-member", role: "member", status: "active", fullName: "Hội viên kiểm tra", memberCode: "HV-LAYOUT", email: "layout@example.test", phone: "0900000000", contacts: [] };
    } else if (pathname.endsWith("/notification-preferences")) {
      data = { email_enabled: true };
    } else if (pathname.endsWith("/notifications")) {
      data = [];
    } else if (pathname.endsWith("/auth/mfa/totp/enrollment")) {
      data = { enrollmentId: "layout-enrollment", secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/Kinetic:layout?secret=JBSWY3DPEHPK3PXP&issuer=Kinetic" };
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });

  await page.goto("/profile");
  await expect(page.getByRole("heading", { name: "Đổi mật khẩu" })).toBeVisible();
  const passwordFields = page.locator(".profile-page__password-form .profile-page__fields label");
  const currentPassword = await passwordFields.nth(0).boundingBox();
  const newPassword = await passwordFields.nth(1).boundingBox();
  const confirmation = await passwordFields.nth(2).boundingBox();
  expect(Math.abs(currentPassword.y - newPassword.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(confirmation.y - currentPassword.y - currentPassword.height - 16)).toBeLessThanOrEqual(1);
  await expect(page.locator('input[aria-label="Mật khẩu mới"]')).toHaveAttribute("aria-describedby", "profile-new-password-hint");
  const collapsedSecurity = await page.locator(".profile-page__security-group").boundingBox();
  const collapsedAuthenticator = await page.locator(".profile-page__mfa").boundingBox();
  expect(collapsedAuthenticator.height).toBeLessThan(collapsedSecurity.height);
  await page.getByRole("button", { name: "Thiết lập Authenticator" }).click();
  await expect(page.getByRole("img", { name: "Mã QR thiết lập Authenticator" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xác nhận Authenticator" })).toBeVisible();

  for (const width of [1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const security = await page.locator(".profile-page__security-group").boundingBox();
    const authenticator = await page.locator(".profile-page__mfa").boundingBox();
    const copyButton = await page.getByRole("button", { name: "Sao chép" }).boundingBox();
    expect(security).not.toBeNull();
    expect(authenticator).not.toBeNull();
    if (width >= 1200) {
      expect(Math.abs(security.y + security.height - authenticator.y - authenticator.height)).toBeLessThanOrEqual(1);
    }
    expect(copyButton.x + copyButton.width).toBeLessThanOrEqual(authenticator.x + authenticator.width + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
