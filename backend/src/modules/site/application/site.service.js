import { AppError, notFoundError } from "../../../shared/errors/app-error.js";
import { pageDraftSchema } from "../domain/site-content.js";

const conflict = () => new AppError({ statusCode: 409, code: "SITE_DRAFT_STALE", message: "Bản nháp đã thay đổi ở tab khác. Tải lại trước khi lưu." });
const noDraft = () => new AppError({ statusCode: 409, code: "SITE_DRAFT_REQUIRED", message: "Cần tạo và lưu bản nháp trước khi xuất bản." });
const missing = () => notFoundError("Không tìm thấy trang website.");
const audit = (tx, actorUserId, action, entityType, entityId, previousValue, newValue) => tx.audit_logs.create({ data: {
  actor_user_id: actorUserId, action, entity_type: entityType, entity_id: entityId,
  summary: action, previous_value: previousValue ?? undefined, new_value: newValue ?? undefined,
} });

export function createSiteService({ repository }) {
  const pageDetail = async (routeKey) => {
    const page = await repository.page(routeKey);
    if (!page) throw missing();
    const [draft, publication, revisions] = await Promise.all([
      repository.pageDraft(page.id), repository.pagePublication(page.id), repository.pageRevisions(page.id),
    ]);
    const published = publication ? await repository.pageRevision(publication.revision_id) : null;
    return { page, draft, published, revisions: revisions.map(({ id, version_number, status, updated_at }) => ({ id, versionNumber: version_number, status, updatedAt: updated_at })) };
  };

  const validateMenuLinks = async (items) => {
    const visit = async (nodes) => {
      for (const node of nodes) {
        if (!node.active) continue;
        if (node.kind === "link" && node.href.startsWith("/")) {
          const path = node.href.split(/[?#]/)[0];
          const builtIn = ["/", "/gallery", "/calendar", "/login", "/register"];
          if (!builtIn.includes(path)) {
            const page = await repository.pageByPath(path);
            if (!page?.is_active || !(await repository.pagePublication(page.id))) {
              throw new AppError({ statusCode: 422, code: "SITE_MENU_TARGET_UNPUBLISHED", message: `Trang đích ${path} chưa được xuất bản.` });
            }
          }
        }
        await visit(node.children);
      }
    };
    await visit(items);
  };

  const validatePageLinks = async (blocks) => {
    for (const block of blocks) {
      const parsed = pageDraftSchema.safeParse({ editRevision: 1, title: "Trang", blocks: [block] });
      if (!parsed.success) throw new AppError({ statusCode: 422, code: "SITE_PAGE_BLOCK_INVALID", message: "Khối nội dung chưa hợp lệ." });
      if (block.buttonHref?.startsWith("/")) await validateMenuLinks([{ id: block.id, label: block.title, kind: "link", href: block.buttonHref, active: block.active, children: [] }]);
    }
  };

  const publicPage = async (page) => {
    if (!page?.is_active) throw missing();
    const publication = await repository.pagePublication(page.id);
    if (!publication) throw missing();
    const revision = await repository.pageRevision(publication.revision_id);
    return { path: page.path, kind: page.kind, title: revision.title, seoTitle: revision.seo_title, seoDescription: revision.seo_description, blocks: revision.blocks };
  };

  const hasVisibleMenuLink = (items) => items.some((item) => item.active && (item.kind === "link" || hasVisibleMenuLink(item.children)));

  return {
    listPages: repository.listPages,
    pageDetail,
    async createPage(input, actorUserId) {
      try { return await repository.transaction(async (tx) => {
        const page = await tx.site_pages.create({ data: { route_key: input.routeKey, path: input.path, kind: input.kind } });
        const draft = await tx.site_page_revisions.create({ data: { page_id: page.id, version_number: 1, title: input.title, blocks: [], created_by: actorUserId, updated_by: actorUserId } });
        await audit(tx, actorUserId, "site.page.created", "site_page", page.id, null, { routeKey: input.routeKey, path: input.path });
        return { page, draft };
      }); } catch (error) {
        if (error.code === "P2002") throw new AppError({ statusCode: 409, code: "SITE_PAGE_EXISTS", message: "Trang hoặc đường dẫn này đã tồn tại." });
        throw error;
      }
    },
    async startPageDraft(routeKey, actorUserId) {
      const page = await repository.page(routeKey);
      if (!page) throw missing();
      try { return await repository.transaction(async (tx) => {
        const existing = await tx.site_page_revisions.findFirst({ where: { page_id: page.id, status: "draft" } });
        if (existing) return existing;
        const latest = await tx.site_page_revisions.findFirst({ where: { page_id: page.id }, orderBy: { version_number: "desc" } });
        const draft = await tx.site_page_revisions.create({ data: {
          page_id: page.id, version_number: (latest?.version_number ?? 0) + 1, title: latest?.title ?? "", seo_title: latest?.seo_title ?? "", seo_description: latest?.seo_description ?? "", blocks: latest?.blocks ?? [], created_by: actorUserId, updated_by: actorUserId,
        } });
        await audit(tx, actorUserId, "site.page.draft_started", "site_page", page.id, null, { revisionId: draft.id });
        return draft;
      }); } catch (error) {
        if (error.code === "P2002") throw conflict();
        throw error;
      }
    },
    async savePageDraft(routeKey, input, actorUserId) {
      const page = await repository.page(routeKey);
      if (!page) throw missing();
      const draft = await repository.pageDraft(page.id);
      if (!draft) throw noDraft();
      if (draft.edit_revision !== input.editRevision) throw conflict();
      return repository.transaction(async (tx) => {
        const changed = await tx.site_page_revisions.updateMany({ where: { id: draft.id, status: "draft", edit_revision: input.editRevision }, data: {
          title: input.title, seo_title: input.seoTitle, seo_description: input.seoDescription, blocks: input.blocks, edit_revision: { increment: 1 }, updated_by: actorUserId,
        } });
        if (!changed.count) throw conflict();
        const saved = await tx.site_page_revisions.findUnique({ where: { id: draft.id } });
        await audit(tx, actorUserId, "site.page.draft_saved", "site_page", page.id, { editRevision: input.editRevision }, { editRevision: saved.edit_revision });
        return saved;
      });
    },
    async publishPage(routeKey, editRevision, actorUserId) {
      const page = await repository.page(routeKey);
      if (!page) throw missing();
      const preflight = await repository.pageDraft(page.id);
      if (!preflight) throw noDraft();
      if (preflight.edit_revision !== editRevision) throw conflict();
      if (!preflight.blocks.some((block) => block.active)) throw new AppError({ statusCode: 422, code: "SITE_PAGE_NOT_READY", message: "Cần ít nhất một khối nội dung đang hiển thị." });
      await validatePageLinks(preflight.blocks);
      return repository.transaction(async (tx) => {
        const draft = await tx.site_page_revisions.findFirst({ where: { page_id: page.id, status: "draft" } });
        if (!draft) throw noDraft();
        if (draft.edit_revision !== editRevision || !draft.blocks.some((block) => block.active)) throw conflict();
        const before = await tx.site_page_publications.findUnique({ where: { page_id: page.id } });
        const changed = await tx.site_page_revisions.updateMany({ where: { id: draft.id, status: "draft", edit_revision: editRevision }, data: { status: "published" } });
        if (!changed.count) throw conflict();
        await tx.site_page_publications.upsert({ where: { page_id: page.id }, create: { page_id: page.id, revision_id: draft.id, published_by: actorUserId }, update: { revision_id: draft.id, published_by: actorUserId, published_at: new Date() } });
        await audit(tx, actorUserId, "site.page.published", "site_page", page.id, { revisionId: before?.revision_id }, { revisionId: draft.id });
        return { revisionId: draft.id };
      });
    },
    async restorePage(routeKey, revisionId, actorUserId) {
      const page = await repository.page(routeKey);
      if (!page) throw missing();
      return repository.transaction(async (tx) => {
        const revision = await tx.site_page_revisions.findFirst({ where: { id: revisionId, page_id: page.id, status: "published" } });
        if (!revision) throw notFoundError("Không tìm thấy phiên bản đã xuất bản.");
        const before = await tx.site_page_publications.findUnique({ where: { page_id: page.id } });
        await tx.site_page_publications.upsert({ where: { page_id: page.id }, create: { page_id: page.id, revision_id: revision.id, published_by: actorUserId }, update: { revision_id: revision.id, published_by: actorUserId, published_at: new Date() } });
        await audit(tx, actorUserId, "site.page.restored", "site_page", page.id, { revisionId: before?.revision_id }, { revisionId });
        return { revisionId };
      });
    },
    async publicPage(routeKey) {
      return publicPage(await repository.page(routeKey));
    },
    async publicPageByPath(path) {
      return publicPage(await repository.pageByPath(path));
    },
    async menuDetail(location) {
      const [draft, publication, revisions] = await Promise.all([repository.menuDraft(location), repository.menuPublication(location), repository.menuRevisions(location)]);
      const published = publication ? await repository.menuRevision(publication.revision_id) : null;
      return { draft, published, revisions: revisions.map(({ id, version_number, status, updated_at }) => ({ id, versionNumber: version_number, status, updatedAt: updated_at })) };
    },
    async saveMenuDraft(location, input, actorUserId) {
      try { return await repository.transaction(async (tx) => {
        const draft = await tx.site_menu_revisions.findFirst({ where: { location, status: "draft" } });
        if (!draft) {
          if (input.editRevision !== 0) throw conflict();
          const latest = await tx.site_menu_revisions.findFirst({ where: { location }, orderBy: { version_number: "desc" } });
          const created = await tx.site_menu_revisions.create({ data: { location, version_number: (latest?.version_number ?? 0) + 1, items: input.items, created_by: actorUserId, updated_by: actorUserId } });
          await audit(tx, actorUserId, "site.menu.draft_saved", "site_menu", created.id, null, { location, editRevision: created.edit_revision });
          return created;
        }
        const changed = await tx.site_menu_revisions.updateMany({ where: { id: draft.id, status: "draft", edit_revision: input.editRevision }, data: { items: input.items, edit_revision: { increment: 1 }, updated_by: actorUserId } });
        if (!changed.count) throw conflict();
        const saved = await tx.site_menu_revisions.findUnique({ where: { id: draft.id } });
        await audit(tx, actorUserId, "site.menu.draft_saved", "site_menu", saved.id, { editRevision: input.editRevision }, { editRevision: saved.edit_revision });
        return saved;
      }); } catch (error) {
        if (error.code === "P2002") throw conflict();
        throw error;
      }
    },
    async publishMenu(location, editRevision, actorUserId) {
      const draft = await repository.menuDraft(location);
      if (!draft) throw noDraft();
      if (draft.edit_revision !== editRevision) throw conflict();
      if (!hasVisibleMenuLink(draft.items)) throw new AppError({ statusCode: 422, code: "SITE_MENU_NOT_READY", message: "Cần ít nhất một liên kết đang hiển thị trước khi xuất bản menu." });
      await validateMenuLinks(draft.items);
      return repository.transaction(async (tx) => {
        const before = await tx.site_menu_publications.findUnique({ where: { location } });
        const changed = await tx.site_menu_revisions.updateMany({ where: { id: draft.id, status: "draft", edit_revision: editRevision }, data: { status: "published" } });
        if (!changed.count) throw conflict();
        await tx.site_menu_publications.upsert({ where: { location }, create: { location, revision_id: draft.id, published_by: actorUserId }, update: { revision_id: draft.id, published_by: actorUserId, published_at: new Date() } });
        await audit(tx, actorUserId, "site.menu.published", "site_menu", draft.id, { revisionId: before?.revision_id }, { revisionId: draft.id });
        return { revisionId: draft.id };
      });
    },
    async restoreMenu(location, revisionId, actorUserId) {
      return repository.transaction(async (tx) => {
        const revision = await tx.site_menu_revisions.findFirst({ where: { id: revisionId, location, status: "published" } });
        if (!revision) throw notFoundError("Không tìm thấy phiên bản menu đã xuất bản.");
        const before = await tx.site_menu_publications.findUnique({ where: { location } });
        await tx.site_menu_publications.upsert({ where: { location }, create: { location, revision_id: revision.id, published_by: actorUserId }, update: { revision_id: revision.id, published_by: actorUserId, published_at: new Date() } });
        await audit(tx, actorUserId, "site.menu.restored", "site_menu", revision.id, { revisionId: before?.revision_id }, { revisionId });
        return { revisionId };
      });
    },
    async publicMenu(location) {
      const publication = await repository.menuPublication(location);
      if (!publication) throw notFoundError("Menu chưa được xuất bản.");
      const revision = await repository.menuRevision(publication.revision_id);
      const visible = (items) => items.filter((item) => item.active).map((item) => ({ ...item, children: visible(item.children) }));
      return { items: visible(revision.items) };
    },
  };
}
