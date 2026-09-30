import { prisma } from "../../../database.js";

const pageProjection = { id: true, route_key: true, path: true, kind: true, is_active: true };
const ordered = { version_number: "desc" };

export const siteRepository = {
  listPages: () => prisma.site_pages.findMany({ select: pageProjection, orderBy: { path: "asc" } }),
  page: (routeKey) => prisma.site_pages.findUnique({ where: { route_key: routeKey } }),
  pageByPath: (path) => prisma.site_pages.findUnique({ where: { path } }),
  pageRevisions: (pageId) => prisma.site_page_revisions.findMany({ where: { page_id: pageId }, orderBy: ordered }),
  pageDraft: (pageId) => prisma.site_page_revisions.findFirst({ where: { page_id: pageId, status: "draft" } }),
  pagePublication: (pageId) => prisma.site_page_publications.findUnique({ where: { page_id: pageId } }),
  pageRevision: (id) => prisma.site_page_revisions.findUnique({ where: { id } }),
  menuRevisions: (location) => prisma.site_menu_revisions.findMany({ where: { location }, orderBy: ordered }),
  menuDraft: (location) => prisma.site_menu_revisions.findFirst({ where: { location, status: "draft" } }),
  menuPublication: (location) => prisma.site_menu_publications.findUnique({ where: { location } }),
  menuRevision: (id) => prisma.site_menu_revisions.findUnique({ where: { id } }),
  createMediaAsset: (data) => prisma.site_media_assets.upsert({ where: { storage_key: data.storage_key }, create: data, update: {} }),
  transaction: (work) => prisma.$transaction(work),
};
