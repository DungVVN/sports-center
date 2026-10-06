import { expect, test } from "@playwright/test";

const memberSession = { user: { id: "fixture-member", role: "member", displayName: "Browser member", status: "active" }, permissions: ["payment.self.read"] };
const staffSession = { user: { id: "fixture-manager", role: "manager", displayName: "Browser manager", status: "active" }, permissions: ["member.read", "payment.read"] };

async function fixtures(page, session) {
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data = [];
    let meta;
    if (path.endsWith("/auth/me")) data = session;
    if (path.endsWith("/members")) {
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const search = url.searchParams.get("search") ?? "";
      data = [{ id: `fixture-${pageNumber}`, memberCode: `HV-${pageNumber}`, fullName: search ? "Ngoài trang đầu" : `Hội viên trang ${pageNumber}` }];
      meta = { page: search ? 1 : pageNumber, pageSize: 10, total: search ? 1 : 21, facets: { coach: ["__unassigned"], package: ["__unregistered"], status: ["__no_membership"] } };
    }
    if (path.endsWith("/payments")) {
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      data = [{ id: `receipt-${pageNumber}`, transaction_code: `PAY-PAGE-${pageNumber}`, amountVnd: "1000", method: "cash", status: "paid" }];
      meta = { page: pageNumber, pageSize: 10, total: 21, facets: { package: [] } };
    }
    if (path.includes("/dashboards/")) data = {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data, ...(meta && { meta }) }) });
  });
}

test("member cannot reach the staff payment workspace by deep link", async ({ page }) => {
  await fixtures(page, memberSession);
  await page.goto("/payments");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Hoạt động của tôi" })).toBeVisible();
});

test("staff member table requests the next page and resets search to the first page", async ({ page }) => {
  await fixtures(page, staffSession);
  await page.goto("/members");
  await expect(page.getByText("Hội viên trang 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sau", exact: true }).click();
  await expect(page.getByText("Hội viên trang 2", { exact: true })).toBeVisible();
  const request = page.waitForRequest((req) => {
    const url = new URL(req.url());
    return url.pathname.endsWith("/members") && url.searchParams.get("page") === "1" && url.searchParams.get("search") === "Ngoài";
  });
  await page.getByPlaceholder("Tìm tên, mã, email...").fill("Ngoài");
  await request;
  await expect(page.getByText("Ngoài trang đầu", { exact: true })).toBeVisible();
});

test("staff receipt pagination remains usable on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixtures(page, staffSession);
  await page.goto("/payments");
  await expect(page.getByText("PAY-PAGE-1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sau", exact: true }).click();
  await expect(page.getByText("PAY-PAGE-2", { exact: true })).toBeVisible();
});
