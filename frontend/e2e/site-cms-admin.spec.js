import { expect, test } from "@playwright/test";

const success = (data) => ({ success: true, data });

test("admin saves a page draft without publishing, then publishes explicitly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageId = "11111111-1111-4111-8111-111111111111";
  const revisionId = "22222222-2222-4222-8222-222222222222";
  const block = { id: "33333333-3333-4333-8333-333333333333", type: "hero", active: true, title: "Kinetic", eyebrow: "", description: "", imageUrl: "", buttonLabel: "", buttonHref: "" };
  let draft = { id: revisionId, title: "Trang chủ", seo_title: "", seo_description: "", edit_revision: 1, blocks: [block] };
  let published = null;
  let publishCalls = 0;

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me")) return route.fulfill({ json: success({ user: { id: pageId, role: "admin", mustChangePassword: false, profileSetupRequired: false }, permissions: [] }) });
    if (path.endsWith("/admin/site/pages") && request.method() === "GET") return route.fulfill({ json: success([{ id: pageId, route_key: "home", path: "/", kind: "home" }]) });
    if (path.endsWith("/admin/site/pages/home") && request.method() === "GET") return route.fulfill({ json: success({ page: { id: pageId, path: "/" }, draft, published, revisions: [] }) });
    if (path.endsWith("/admin/site/pages/home/draft") && request.method() === "PUT") {
      const body = request.postDataJSON();
      draft = { ...draft, title: body.title, blocks: body.blocks, edit_revision: draft.edit_revision + 1 };
      return route.fulfill({ json: success(draft) });
    }
    if (path.endsWith("/admin/site/pages/home/publish") && request.method() === "POST") {
      publishCalls += 1;
      published = { ...draft, status: "published" };
      draft = null;
      return route.fulfill({ json: success({ revisionId }) });
    }
    if (path.endsWith("/dashboard/notifications")) return route.fulfill({ json: success([]) });
    return route.fulfill({ json: success([]) });
  });

  await page.goto("/admin/site/pages", { waitUntil: "domcontentloaded" });
  const title = page.getByLabel("Tiêu đề trang");
  await expect(title).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await title.fill("Trang chủ mới");
  await expect(page.getByRole("button", { name: "Xuất bản" })).toBeDisabled();
  await page.getByRole("button", { name: "Lưu nháp" }).click();
  await expect(page.getByText("Đã lưu bản nháp. Chưa xuất bản.")).toBeVisible();
  expect(publishCalls).toBe(0);
  await expect(page.getByRole("button", { name: "Xuất bản" })).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Xuất bản" }).click();
  await expect(page.getByText("Đã xuất bản trang.")).toBeVisible();
  expect(publishCalls).toBe(1);
});
