import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  site_pages: { findMany: vi.fn() },
  site_page_revisions: { findMany: vi.fn() },
  site_page_publications: { findMany: vi.fn() },
};

vi.mock("../src/database.js", () => ({ prisma }));

const { siteRepository } = await import("../src/modules/site/infrastructure/site.repository.js");

describe("site page catalog repository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty catalog without querying revisions", async () => {
    prisma.site_pages.findMany.mockResolvedValue([]);
    await expect(siteRepository.listPages()).resolves.toEqual([]);
    expect(prisma.site_page_revisions.findMany).not.toHaveBeenCalled();
  });

  it("summarizes each page from its draft and published revision", async () => {
    prisma.site_pages.findMany.mockResolvedValue([
      { id: "home", route_key: "home", path: "/", is_active: true },
      { id: "about", route_key: "about", path: "/about", is_active: true },
    ]);
    prisma.site_page_revisions.findMany
      .mockResolvedValueOnce([{ page_id: "home", title: "Trang chủ", version_number: 2, updated_at: "2026-09-30", blocks: [{ id: "one" }] }])
      .mockResolvedValueOnce([{ id: "published-about", title: "Giới thiệu", version_number: 3, blocks: [{ id: "two" }, { id: "three" }] }]);
    prisma.site_page_publications.findMany.mockResolvedValue([{ page_id: "about", revision_id: "published-about", published_at: "2026-09-29" }]);

    await expect(siteRepository.listPages()).resolves.toEqual([
      expect.objectContaining({ id: "home", title: "Trang chủ", draft_version: 2, published_version: null, block_count: 1 }),
      expect.objectContaining({ id: "about", title: "Giới thiệu", draft_version: null, published_version: 3, block_count: 2 }),
    ]);
    expect(prisma.site_page_publications.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { page_id: { in: ["home", "about"] } } }));
  });
});
