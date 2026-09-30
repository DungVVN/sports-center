import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { menuDraftSchema, pageCreateSchema, pageDraftSchema } from "../src/modules/site/domain/site-content.js";

const uuid = "11111111-1111-4111-8111-111111111111";
const auth = (role) => ({ getAuthentication: vi.fn().mockResolvedValue({ user: { id: uuid, role }, permissions: [] }) });
const siteService = () => ({
  publicPage: vi.fn().mockResolvedValue({ path: "/", kind: "home", title: "Trang chủ", blocks: [] }),
  publicMenu: vi.fn().mockResolvedValue({ items: [] }),
  listPages: vi.fn().mockResolvedValue([]),
  pageDetail: vi.fn().mockResolvedValue({ page: { route_key: "home" }, draft: null, published: null, revisions: [] }),
  createPage: vi.fn().mockResolvedValue({ page: { route_key: "home" } }),
  startPageDraft: vi.fn().mockResolvedValue({ id: uuid }),
  savePageDraft: vi.fn().mockResolvedValue({ id: uuid }),
  publishPage: vi.fn().mockResolvedValue({ revisionId: uuid }),
  restorePage: vi.fn().mockResolvedValue({ revisionId: uuid }),
  createSiteUploadSignature: vi.fn().mockResolvedValue({ cloudName: "demo", apiKey: "key", timestamp: 1, signature: "signature", folder: "kinetic-sports/site", uploadUrl: "https://example.test", maxBytes: 10 }),
  recordUpload: vi.fn().mockResolvedValue({ id: uuid }),
  menuDetail: vi.fn().mockResolvedValue({ draft: null, published: null, revisions: [] }),
  saveMenuDraft: vi.fn().mockResolvedValue({ id: uuid }),
  publishMenu: vi.fn().mockResolvedValue({ revisionId: uuid }),
});

describe("site content contracts", () => {
  it("keeps public reading separate from admin writing", async () => {
    const service = siteService();
    const app = createApp({ authService: auth("member"), siteService: service });
    await request(app).get("/api/v1/site/pages/home").expect(200);
    await request(app).get("/api/v1/site/menus/header").expect(200);
    await request(app).get("/api/v1/admin/site/pages").expect(401);
    await request(app).post("/api/v1/admin/site/pages/home/publish").set("Authorization", "Bearer token").send({ editRevision: 1 }).expect(403);
    expect(service.publishPage).not.toHaveBeenCalled();
  });

  it("lets admin save draft and publish only through distinct endpoints", async () => {
    const service = siteService();
    const app = createApp({ authService: auth("admin"), siteService: service });
    const block = { id: uuid, type: "hero", title: "Kinetic", active: true };
    await request(app).put("/api/v1/admin/site/pages/home/draft").set("Authorization", "Bearer token").send({ editRevision: 1, title: "Trang chủ", blocks: [block] }).expect(200);
    expect(service.savePageDraft).toHaveBeenCalledWith("home", expect.objectContaining({ editRevision: 1 }), uuid);
    expect(service.publishPage).not.toHaveBeenCalled();
    await request(app).post("/api/v1/admin/site/pages/home/publish").set("Authorization", "Bearer token").send({ editRevision: 1 }).expect(200);
    expect(service.publishPage).toHaveBeenCalledWith("home", 1, uuid);
  });

  it("issues Cloudinary upload credentials only to an authenticated admin", async () => {
    const service = siteService();
    const app = createApp({ authService: auth("admin"), siteService: service, cloudinaryMediaService: service });
    await request(app).post("/api/v1/admin/site/media/cloudinary/signature").expect(401);
    await request(app).post("/api/v1/admin/site/media/cloudinary/signature").set("Authorization", "Bearer token").send({}).expect(200);
    expect(service.createSiteUploadSignature).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe URLs, duplicate IDs, reserved routes and deep menus", () => {
    expect(pageCreateSchema.safeParse({ routeKey: "login", path: "/login", kind: "static", title: "Login" }).success).toBe(false);
    expect(pageCreateSchema.safeParse({ routeKey: "home", path: "/gioi-thieu", kind: "static", title: "Sai" }).success).toBe(false);
    expect(pageCreateSchema.safeParse({ routeKey: "gioi-thieu", path: "/", kind: "static", title: "Sai" }).success).toBe(false);
    const hero = { id: uuid, type: "hero", title: "Kinetic", buttonHref: "javascript:alert(1)" };
    expect(pageDraftSchema.safeParse({ editRevision: 1, title: "Trang", blocks: [hero] }).success).toBe(false);
    const validHero = { ...hero, buttonHref: "/register" };
    expect(pageDraftSchema.safeParse({ editRevision: 1, title: "Trang", blocks: [validHero, validHero] }).success).toBe(false);
    const child = { id: "22222222-2222-4222-8222-222222222222", label: "Con", kind: "link", href: "/" };
    const group = { id: uuid, label: "Nhóm", kind: "group", children: [{ ...child, children: [child] }] };
    expect(menuDraftSchema.safeParse({ editRevision: 0, items: [group] }).success).toBe(false);
  });
});
