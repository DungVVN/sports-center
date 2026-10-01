// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { loadPublicDocument, pageHead, renderBlocks, renderPageBody, serializeJson } from "./public-seo.js";

const page = { title: "Dịch vụ", seoTitle: "Dịch vụ | Kinetic", seoDescription: "Gym & Yoga", blocks: [{ id: "hero", type: "hero", active: true, title: "Gym & Yoga", description: "Nội dung công khai" }] };
const response = (data, status = 200) => new Response(JSON.stringify({ success: status === 200, data }), { status, headers: { "Content-Type": "application/json" } });

describe("public HTML SEO", () => {
  it("renders current published content without scripts or unsafe URLs from CMS", () => {
    const html = renderBlocks([{ type: "hero", active: true, title: '<script>alert("x")</script>', description: "A & B", imageUrl: "javascript:alert(1)", buttonLabel: "Unsafe", buttonHref: "//evil.example" }, { type: "richText", active: false, title: "Draft secret" }]);
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).not.toMatch(/<script|javascript:|evil\.example|Draft secret/);
  });

  it("prevents CMS text from breaking out of JSON bootstrap scripts", () => {
    expect(serializeJson({ title: "</script><script>alert(1)</script>" })).not.toContain("<");
  });

  it("uses the production canonical in metadata and breadcrumbs", () => {
    const html = pageHead({ path: "/dich-vu", page });
    expect(html).toContain('rel="canonical" href="https://kineticsports.io.vn/dich-vu"');
    expect(html).toContain('property="og:title" content="Dịch vụ | Kinetic"');
    expect(html).toContain("Gym &amp; Yoga");
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  it("does not publish structured data on preview or error pages", () => {
    const html = pageHead({ path: "/dich-vu", page, noindex: true });
    expect(html).toContain("noindex,follow");
    expect(html).not.toContain("application/ld+json");
  });

  it("loads a page without auth cookies and renders crawlable content", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(page));
    const document = await loadPublicDocument("/dich-vu", {}, fetcher);
    expect(document.status).toBe(200);
    expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty("Cookie");
    expect(renderPageBody(document)).toContain("<h1>Gym &amp; Yoga</h1>");
  });

  it("includes current package prices in raw pricing HTML", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response(page)).mockResolvedValueOnce(response([{ code: "BASIC", name: "Basic", durationDays: 30, priceVnd: "490000", benefits: ["Tủ đồ"] }]));
    const document = await loadPublicDocument("/bang-gia", {}, fetcher);
    expect(renderPageBody(document)).toContain("490.000 ₫ / gói");
    expect(document.packages).toHaveLength(1);
  });

  it("returns 404 for unpublished content instead of an empty 200 shell", async () => {
    const document = await loadPublicDocument("/dich-vu", {}, vi.fn().mockResolvedValue(response(null, 404)));
    expect(document.status).toBe(404);
    expect(document.noindex).toBe(true);
  });

  it("returns 503 for upstream failures so bots do not index a temporary empty page", async () => {
    const document = await loadPublicDocument("/dich-vu", {}, vi.fn().mockRejectedValue(new Error("offline")));
    expect(document.status).toBe(503);
  });

  it("looks up arbitrary CMS paths but keeps unpublished pages at 404", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(null, 404));
    expect((await loadPublicDocument("/unknown", {}, fetcher)).status).toBe(404);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps the legacy home fallback when no CMS home has been published", async () => {
    const fetcher = vi.fn().mockResolvedValue(response(null, 404));
    const document = await loadPublicDocument("/", {}, fetcher);
    expect(renderPageBody(document)).toContain('href="/bang-gia"');
    expect(document.page.seoTitle).toContain("Gym, Yoga");
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it.each(["/", "/huong-dan-dang-ky-tap-luyen"])("serves published CMS content and metadata at %s", async (path) => {
    const document = await loadPublicDocument(path, {}, vi.fn().mockResolvedValue(response(page)));
    expect(document.page).toEqual(page);
    expect(document.status).toBe(200);
    expect(renderPageBody(document)).toContain("<h1>Gym &amp; Yoga</h1>");
  });
});
