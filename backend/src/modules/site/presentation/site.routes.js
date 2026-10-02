import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../../../shared/auth/authentication.middleware.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";
import { menuDraftSchema, pageCreateSchema, pageDraftSchema, siteLocationSchema } from "../domain/site-content.js";

const routeKey = z.string().regex(/^[a-z][a-z0-9_-]*$/).max(80);
const routeParam = z.object({ params: z.object({ routeKey }) });
const locationParam = z.object({ params: z.object({ location: siteLocationSchema }) });
const revisionBody = z.object({ body: z.object({ editRevision: z.number().int().positive() }).strict(), params: z.object({ routeKey }) });
const uploadRecordBody = z.object({ body: z.object({
  secureUrl: z.string().url().max(2048), publicId: z.string().min(1).max(255), originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().regex(/^image\/[a-z0-9][a-z0-9.+-]*$/).max(64), bytes: z.number().int().positive().max(20 * 1024 * 1024),
  width: z.number().int().positive().max(10000).nullable(), height: z.number().int().positive().max(10000).nullable(),
}).strict() });
const handle = (work) => async (req, res, next) => { try { sendSuccess(res, { data: await work(req) }); } catch (error) { next(error); } };

export function createSiteRouter(service, authService, cloudinaryMediaService) {
  const router = Router();
  const admin = [authenticate(authService), (req, _res, next) => req.auth.user.role === "admin" ? next() : next(new AppError({ statusCode: 403, code: "ADMIN_REQUIRED", message: "Chỉ admin được quản lý website." }))];

  router.get("/site/page", validateRequest(z.object({ query: z.object({ path: z.string().regex(/^\/(?:[a-z0-9][a-z0-9/-]*)?$/).max(240) }) })), handle((req) => service.publicPageByPath(req.validated.query.path)));
  router.get("/site/pages/:routeKey", validateRequest(routeParam), handle((req) => service.publicPage(req.validated.params.routeKey)));
  router.get("/site/menus/:location", validateRequest(locationParam), handle((req) => service.publicMenu(req.validated.params.location)));

  router.get("/admin/site/pages", ...admin, handle(() => service.listPages()));
  router.post("/admin/site/media/cloudinary/signature", ...admin, handle(() => cloudinaryMediaService.createSiteUploadSignature()));
  router.post("/admin/site/media/cloudinary", ...admin, validateRequest(uploadRecordBody), handle((req) => cloudinaryMediaService.recordUpload(req.validated.body, req.auth.user.id)));
  router.post("/admin/site/pages", ...admin, validateRequest(z.object({ body: pageCreateSchema })), handle((req) => service.createPage(req.validated.body, req.auth.user.id)));
  router.delete("/admin/site/pages/:routeKey", ...admin, validateRequest(routeParam), handle((req) => service.deletePage(req.validated.params.routeKey, req.auth.user.id)));
  router.get("/admin/site/pages/:routeKey", ...admin, validateRequest(routeParam), handle((req) => service.pageDetail(req.validated.params.routeKey)));
  router.post("/admin/site/pages/:routeKey/draft", ...admin, validateRequest(routeParam), handle((req) => service.startPageDraft(req.validated.params.routeKey, req.auth.user.id)));
  router.put("/admin/site/pages/:routeKey/draft", ...admin, validateRequest(z.object({ params: z.object({ routeKey }), body: pageDraftSchema })), handle((req) => service.savePageDraft(req.validated.params.routeKey, req.validated.body, req.auth.user.id)));
  router.post("/admin/site/pages/:routeKey/publish", ...admin, validateRequest(revisionBody), handle((req) => service.publishPage(req.validated.params.routeKey, req.validated.body.editRevision, req.auth.user.id)));
  router.post("/admin/site/pages/:routeKey/restore", ...admin, validateRequest(z.object({ params: z.object({ routeKey }), body: z.object({ revisionId: z.string().uuid() }).strict() })), handle((req) => service.restorePage(req.validated.params.routeKey, req.validated.body.revisionId, req.auth.user.id)));

  router.get("/admin/site/menus/:location", ...admin, validateRequest(locationParam), handle((req) => service.menuDetail(req.validated.params.location)));
  router.put("/admin/site/menus/:location/draft", ...admin, validateRequest(z.object({ params: z.object({ location: siteLocationSchema }), body: menuDraftSchema })), handle((req) => service.saveMenuDraft(req.validated.params.location, req.validated.body, req.auth.user.id)));
  router.post("/admin/site/menus/:location/publish", ...admin, validateRequest(z.object({ params: z.object({ location: siteLocationSchema }), body: z.object({ editRevision: z.number().int().positive() }).strict() })), handle((req) => service.publishMenu(req.validated.params.location, req.validated.body.editRevision, req.auth.user.id)));
  router.post("/admin/site/menus/:location/restore", ...admin, validateRequest(z.object({ params: z.object({ location: siteLocationSchema }), body: z.object({ revisionId: z.string().uuid() }).strict() })), handle((req) => service.restoreMenu(req.validated.params.location, req.validated.body.revisionId, req.auth.user.id)));
  return router;
}
