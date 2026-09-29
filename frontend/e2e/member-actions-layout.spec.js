import { expect, test } from "@playwright/test";

test("member action column stays compact for both credential labels", async ({ page }) => {
  await page.route("**/api/v1/**", (route) => {
    const { pathname } = new URL(route.request().url());
    let data = [];
    if (pathname.endsWith("/auth/me")) {
      data = { user: { id: "layout-manager", role: "manager", displayName: "Quản lý kiểm tra", mustChangePassword: false, profileSetupRequired: false }, permissions: ["member.read", "member.write", "member.credentials.reset"] };
    } else if (pathname.endsWith("/members")) {
      data = [
        { id: "member-1", memberCode: "MBR-1", fullName: "Hội viên một", email: "one@example.test", phone: "0900000001", hasAccount: true },
        { id: "member-2", memberCode: "MBR-2", fullName: "Hội viên hai", email: "two@example.test", phone: "0900000002", hasAccount: false },
      ];
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data }) });
  });

  await page.goto("/members");
  const groups = page.locator(".member-row-actions");
  await expect(groups).toHaveCount(2);

  for (const width of [1920, 1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const first = await groups.nth(0).boundingBox();
    const second = await groups.nth(1).boundingBox();
    expect(Math.abs(first.width - second.width)).toBeLessThanOrEqual(1);
    expect(first.width).toBeLessThan(200);
    for (const group of [groups.nth(0), groups.nth(1)]) {
      const edit = await group.getByRole("button", { name: "Sửa" }).boundingBox();
      const coach = await group.getByRole("button", { name: "Coach" }).boundingBox();
      const account = await group.locator(".member-row-actions__account").boundingBox();
      expect(Math.abs(edit.y - coach.y)).toBeLessThanOrEqual(1);
      expect(account.y).toBeGreaterThan(edit.y + edit.height);
      expect(account.x + account.width).toBeLessThanOrEqual(first.x + first.width + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});
