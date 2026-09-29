import { expect, test } from "@playwright/test";

test("login controls share the standard reCAPTCHA width when the widget is enabled", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Đăng nhập" })).toBeVisible();

  // Local development may disable the external CAPTCHA; model its standard-width host.
  await page.locator(".auth-form").evaluate((form) => {
    const field = document.createElement("div");
    field.className = "field captcha-field";
    const widget = document.createElement("div");
    widget.style.width = "304px";
    widget.style.height = "78px";
    field.appendChild(widget);
    form.insertBefore(field, form.querySelector('button[type="submit"]'));
  });

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = await page.locator(".auth-card--login, #login-email, #login-password, .captcha-field > div, .auth-form > button[type='submit']").evaluateAll((elements) => elements.map((element) => {
      const { left, right, width: elementWidth } = element.getBoundingClientRect();
      return { left, right, width: elementWidth };
    }));
    expect(controls).toHaveLength(5);
    for (const control of controls) {
      expect(Math.abs(control.left - controls[0].left)).toBeLessThanOrEqual(1);
      expect(Math.abs(control.right - controls[0].right)).toBeLessThanOrEqual(1);
    }
    expect(Math.abs(controls[0].width - 304)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
