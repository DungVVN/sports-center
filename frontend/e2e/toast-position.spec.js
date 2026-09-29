import { expect, test } from "@playwright/test";

test.describe("global error toast position", () => {
  test.skip(process.env.E2E_LOCAL_FULL !== "1", "Run against the approved local application.");

  for (const viewport of [
    { name: "mobile", width: 390, height: 844 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    test(`shows the validation error at the requested ${viewport.name} position`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        const page = await context.newPage();
        await page.goto("/login");
        await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
        const toast = page.locator(".toast--error");
        await expect(toast).toBeVisible();
        await expect(toast).toHaveAttribute("role", "alert");
        await toast.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));

        const rect = await toast.boundingBox();
        expect(rect).not.toBeNull();
        if (viewport.name === "mobile") {
          expect(Math.abs(rect.x + rect.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1);
          expect(rect.y).toBeGreaterThanOrEqual(16);
          expect(rect.y).toBeLessThanOrEqual(24);
        } else {
          expect(Math.abs(viewport.width - rect.x - rect.width - 24)).toBeLessThanOrEqual(1);
          expect(Math.abs(rect.y - 24)).toBeLessThanOrEqual(1);
        }
      } finally {
        await context.close();
      }
    });
  }
});
