import { describe, expect, it, vi } from "vitest";
import { createSiteService } from "../src/modules/site/application/site.service.js";

const pageId = "11111111-1111-4111-8111-111111111111";
const revisionId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const activeBlock = { id: "44444444-4444-4444-8444-444444444444", type: "richText", active: true, title: "Nội dung", body: "Xin chào" };

function pageRepository({ draft, publication = null }) {
  const tx = {
    site_page_revisions: {
      findFirst: vi.fn().mockResolvedValue(draft),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    site_page_publications: {
      findUnique: vi.fn().mockResolvedValue(publication),
      upsert: vi.fn().mockResolvedValue({}),
    },
    audit_logs: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    page: vi.fn().mockResolvedValue({ id: pageId, route_key: "home", path: "/", is_active: true }),
    pageByPath: vi.fn().mockResolvedValue({ id: pageId, route_key: "home", path: "/", is_active: true }),
    pageDraft: vi.fn().mockResolvedValue(draft),
    pagePublication: vi.fn().mockResolvedValue(publication),
    pageRevision: vi.fn().mockResolvedValue({ title: "Đã xuất bản", blocks: [activeBlock] }),
    transaction: vi.fn(async (work) => work(tx)),
    tx,
  };
}

describe("site service publication boundary", () => {
  it("does not expose a saved draft on the public endpoint", async () => {
    const repository = pageRepository({ draft: { id: revisionId, edit_revision: 2, blocks: [activeBlock] } });
    const service = createSiteService({ repository });
    await expect(service.publicPage("home")).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.publicPageByPath("/")).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.pageRevision).not.toHaveBeenCalled();
  });

  it("requires the current saved revision and an explicit publish operation", async () => {
    const draft = { id: revisionId, edit_revision: 2, blocks: [activeBlock] };
    const repository = pageRepository({ draft });
    const service = createSiteService({ repository });
    await expect(service.publishPage("home", 1, actorId)).rejects.toMatchObject({ code: "SITE_DRAFT_STALE" });
    expect(repository.tx.site_page_publications.upsert).not.toHaveBeenCalled();

    await expect(service.publishPage("home", 2, actorId)).resolves.toEqual({ revisionId });
    expect(repository.tx.site_page_revisions.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: "draft", edit_revision: 2 }), data: { status: "published" } }));
    expect(repository.tx.site_page_publications.upsert).toHaveBeenCalledTimes(1);
  });

  it("rejects a page or menu with no visible content", async () => {
    const repository = pageRepository({ draft: { id: revisionId, edit_revision: 1, blocks: [{ ...activeBlock, active: false }] } });
    repository.menuDraft = vi.fn().mockResolvedValue({ id: revisionId, edit_revision: 1, items: [{ kind: "group", active: true, children: [] }] });
    const service = createSiteService({ repository });
    await expect(service.publishPage("home", 1, actorId)).rejects.toMatchObject({ code: "SITE_PAGE_NOT_READY" });
    await expect(service.publishMenu("header", 1, actorId)).rejects.toMatchObject({ code: "SITE_MENU_NOT_READY" });
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});
