import { prisma } from "../../../database.js";

const pageProjection = { id: true, route_key: true, path: true, kind: true, is_active: true };
const ordered = { version_number: "desc" };

export const siteRepository = {
  async listPages() {
    const pages = await prisma.site_pages.findMany({ select: pageProjection, orderBy: { path: "asc" } });
    if (!pages.length) return pages;
    const pageIds = pages.map((page) => page.id);
    const [drafts, publications] = await Promise.all([
      prisma.site_page_revisions.findMany({ where: { page_id: { in: pageIds }, status: "draft" }, select: { page_id: true, title: true, version_number: true, updated_at: true, blocks: true } }),
      prisma.site_page_publications.findMany({ where: { page_id: { in: pageIds } }, select: { page_id: true, revision_id: true, published_at: true } }),
    ]);
    const publishedRevisions = publications.length ? await prisma.site_page_revisions.findMany({
      where: { id: { in: publications.map((publication) => publication.revision_id) } },
      select: { id: true, title: true, version_number: true, blocks: true },
    }) : [];
    const draftByPage = new Map(drafts.map((draft) => [draft.page_id, draft]));
    const publicationByPage = new Map(publications.map((publication) => [publication.page_id, publication]));
    const revisionById = new Map(publishedRevisions.map((revision) => [revision.id, revision]));
    return pages.map((page) => {
      const draft = draftByPage.get(page.id);
      const publication = publicationByPage.get(page.id);
      const published = publication && revisionById.get(publication.revision_id);
      return {
        ...page,
        title: draft?.title ?? published?.title ?? (page.route_key === "home" ? "Trang chủ" : page.route_key),
        draft_version: draft?.version_number ?? null,
        published_version: published?.version_number ?? null,
        block_count: draft?.blocks?.length ?? published?.blocks?.length ?? 0,
        updated_at: draft?.updated_at ?? publication?.published_at ?? null,
      };
    });
  },
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
