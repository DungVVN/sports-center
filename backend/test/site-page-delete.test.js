import { describe, expect, it, vi } from "vitest";
import { createSiteService } from "../src/modules/site/application/site.service.js";

function setup({ path = "/about", active = true, menus = [] } = {}) {
  const page = { id: "page-id", route_key: "about", path, is_active: active };
  const tx = {
    site_pages: {
      findUnique: vi.fn().mockResolvedValue(page),
      update: vi.fn(async ({ data }) => Object.assign(page, data)),
    },
    site_menu_publications: { findMany: vi.fn().mockResolvedValue([{ revision_id: "published-menu" }]) },
    site_menu_revisions: { findMany: vi.fn().mockResolvedValue(menus) },
    audit_logs: { create: vi.fn().mockResolvedValue({}) },
    site_page_revisions: { findFirst: vi.fn() },
  };
  const repository = {
    page: vi.fn().mockResolvedValue(page),
    pageDraft: vi.fn().mockResolvedValue({ id: "draft", edit_revision: 1, blocks: [{ active: true }] }),
    pagePublication: vi.fn(),
    transaction: vi.fn(async (work) => work(tx)),
  };
  return { service: createSiteService({ repository }), repository, tx };
}

describe("CMS page deletion", () => {
  it("deactivates the page, records one audit, and stops public reads without deleting history", async () => {
    const { service, tx, repository } = setup();
    await expect(service.deletePage("about", "admin-id")).resolves.toEqual({ routeKey: "about", path: "/about", deleted: true });
    expect(tx.site_pages.update).toHaveBeenCalledExactlyOnceWith({ where: { id: "page-id" }, data: { is_active: false } });
    expect(tx.audit_logs.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ data: expect.objectContaining({ action: "site.page.deleted", actor_user_id: "admin-id", entity_id: "page-id" }) }));
    await expect(service.publicPage("about")).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.pageDetail("about")).rejects.toMatchObject({ statusCode: 404 });
    expect(repository.pagePublication).not.toHaveBeenCalled();
    await expect(service.deletePage("about", "admin-id")).rejects.toMatchObject({ statusCode: 404 });
    expect(tx.audit_logs.create).toHaveBeenCalledTimes(1);
  });

  it.each(["/", "/gallery", "/calendar"])("protects integrated route %s", async (path) => {
    const { service, tx } = setup({ path });
    await expect(service.deletePage("about", "admin-id")).rejects.toMatchObject({ statusCode: 409, code: "SITE_PAGE_PROTECTED" });
    expect(tx.site_pages.update).not.toHaveBeenCalled();
    expect(tx.audit_logs.create).not.toHaveBeenCalled();
  });

  it.each([true, false])("rejects nested menu references even when active=%s", async (active) => {
    const { service, tx } = setup({ menus: [{ items: [{ kind: "group", active, children: [{ kind: "link", href: "/about?source=menu#intro", children: [] }] }] }] });
    await expect(service.deletePage("about", "admin-id")).rejects.toMatchObject({ statusCode: 409, code: "SITE_PAGE_IN_MENU" });
    expect(tx.site_menu_revisions.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { OR: [{ status: "draft" }, { id: { in: ["published-menu"] } }] } }));
    expect(tx.site_pages.update).not.toHaveBeenCalled();
  });

  it("ignores references to other paths", async () => {
    const { service } = setup({ menus: [{ items: [{ kind: "link", href: "/about-us", children: [] }] }] });
    await expect(service.deletePage("about", "admin-id")).resolves.toMatchObject({ deleted: true });
  });

  it("rejects draft creation if the page was deleted after the initial read", async () => {
    const { service, tx } = setup();
    tx.site_pages.findUnique.mockResolvedValue({ id: "page-id", is_active: false });
    await expect(service.startPageDraft("about", "admin-id")).rejects.toMatchObject({ statusCode: 404 });
    expect(tx.site_page_revisions.findFirst).not.toHaveBeenCalled();
  });

  it("prevents restoring a menu that points at a deleted page", async () => {
    const { service, tx } = setup({ active: false });
    tx.site_menu_revisions.findFirst = vi.fn().mockResolvedValue({ id: "old-menu", items: [{ active: true, kind: "link", href: "/about", children: [] }] });
    await expect(service.restoreMenu("header", "old-menu", "admin-id")).rejects.toMatchObject({ code: "SITE_MENU_TARGET_UNPUBLISHED" });
    expect(tx.audit_logs.create).not.toHaveBeenCalled();
  });
});
