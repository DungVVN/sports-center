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
    if (path.endsWith("/admin/site/pages") && request.method() === "GET") return route.fulfill({ json: success([{ id: pageId, route_key: "home", path: "/", kind: "home", title: draft?.title ?? published?.title ?? "Trang chủ", draft_version: draft ? 1 : null, published_version: published ? 1 : null, block_count: draft?.blocks.length ?? published?.blocks.length ?? 0 }]) });
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
  await expect(page.getByRole("heading", { name: "Danh mục trang toàn website" })).toBeVisible();
  await page.getByRole("button", { name: "Sửa trang Trang chủ" }).click();
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

test("catalog and menu tree keep the reference layout without changing publication", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageId = "11111111-1111-4111-8111-111111111111";
  const item = { id: "22222222-2222-4222-8222-222222222222", label: "Về chúng tôi", kind: "link", href: "/#about", active: true, children: [] };
  let saveCalls = 0;
  let publishCalls = 0;
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/auth/me")) return route.fulfill({ json: success({ user: { id: pageId, role: "admin", mustChangePassword: false, profileSetupRequired: false }, permissions: [] }) });
    if (path.endsWith("/admin/site/pages")) return route.fulfill({ json: success([
      { id: pageId, route_key: "home", path: "/", kind: "home", title: "Trang chủ", is_active: true, draft_version: 1, published_version: null, block_count: 7 },
      { id: "33333333-3333-4333-8333-333333333333", route_key: "gioi-thieu", path: "/gioi-thieu", kind: "static", title: "Giới thiệu", is_active: true, draft_version: 2, published_version: 1, block_count: 4 },
    ]) });
    if (path.endsWith("/admin/site/pages/home")) return route.fulfill({ json: success({ page: { id: pageId, path: "/" }, draft: { id: "55555555-5555-4555-8555-555555555555", title: "Trang chủ", seo_title: "Kinetic Sports Center", seo_description: "", edit_revision: 1, blocks: [{ id: "66666666-6666-4666-8666-666666666666", type: "hero", active: true, title: "Đánh Thức Đam Mê Kiến Tạo Sức Khỏe", eyebrow: "TRUNG TÂM THỂ THAO", description: "Không gian tập luyện hiện đại", imageUrl: "/assets/images/gym.jpg", buttonLabel: "", buttonHref: "" }] }, published: null, revisions: [] }) });
    if (path.endsWith("/admin/site/menus/header")) return route.fulfill({ json: success({ draft: { id: "44444444-4444-4444-8444-444444444444", edit_revision: 1, items: [item] }, published: null, revisions: [] }) });
    if (path.endsWith("/dashboard/notifications")) return route.fulfill({ json: success([]) });
    if (request.method() === "PUT") saveCalls += 1;
    if (path.endsWith("/publish")) publishCalls += 1;
    return route.fulfill({ json: success([]) });
  });
  await page.goto("/admin/site/pages", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Danh mục trang toàn website" })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("textbox", { name: "Tìm trang website" }).fill("giới thiệu");
  await expect(page.getByText("Đang hiển thị 1 trên tổng số 2 trang")).toBeVisible();
  await page.getByRole("textbox", { name: "Tìm trang website" }).fill("");
  if (process.env.CMS_CAPTURE_UI === "1") await page.screenshot({ path: "test-results/site-cms-catalog.png", fullPage: true });
  await page.getByRole("button", { name: "Sửa trang Trang chủ" }).click();
  await expect(page.getByText("1 phần trên trang")).toBeVisible();
  if (process.env.CMS_CAPTURE_UI === "1") await page.screenshot({ path: "test-results/site-cms-page-editor.png", fullPage: true });
  await page.goto("/admin/site/menu", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Menu & điều hướng website" })).toBeVisible();
  await expect(page.getByLabel("Sơ đồ cây menu")).toBeVisible();
  await page.getByRole("button", { name: "Chỉnh sửa Về chúng tôi" }).click();
  await expect(page.getByLabel("Bảng chỉnh sửa mục menu")).toBeVisible();
  await page.getByRole("button", { name: "Phóng to sơ đồ" }).click();
  if (process.env.CMS_CAPTURE_UI === "1") {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: "test-results/site-cms-menu.png" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(saveCalls).toBe(0);
  expect(publishCalls).toBe(0);
});
