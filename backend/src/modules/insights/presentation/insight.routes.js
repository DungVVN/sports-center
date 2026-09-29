import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";

const id = z.string().uuid();
const reportQuery = z.object({ period: z.enum(["day", "week", "month", "quarter", "year", "custom"]).optional(), from: z.string().date().optional(), to: z.string().date().optional(), coachUserId: z.string().uuid().optional() }).superRefine((value, context) => { if (value.period === "custom" && (!value.from || !value.to)) context.addIssue({ code: "custom", message: "Khoảng tùy chọn cần ngày bắt đầu và kết thúc." }); if (value.from && value.to && value.from > value.to) context.addIssue({ code: "custom", message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." }); });

export function createInsightRouter(service, authService) {
  const router = Router(); const auth = authenticate(authService);
  router.get("/notifications", auth, async (req, res, next) => { try { sendSuccess(res, { data: await service.notifications(req.auth.user.id) }); } catch (error) { next(error); } });
  router.patch("/notifications/:id/read", auth, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.markRead(req.validated.params.id, req.auth.user.id) }); } catch (error) { next(error); } });
  router.get("/dashboards/:role", auth, validateRequest(z.object({ query: reportQuery })), async (req, res, next) => { try { sendSuccess(res, { data: await service.dashboard(req.params.role, req.auth.user, req.validated.query) }); } catch (error) { next(error); } });
  router.get("/reports/revenue", auth, requirePermission("report.read"), validateRequest(z.object({ query: reportQuery })), async (req, res, next) => { try { sendSuccess(res, { data: await service.revenue(req.validated.query) }); } catch (error) { next(error); } });
  router.get("/reports/attendance", auth, requirePermission("report.read"), validateRequest(z.object({ query: reportQuery })), async (req, res, next) => { try { sendSuccess(res, { data: await service.attendance(req.validated.query) }); } catch (error) { next(error); } });
  router.get("/reports/:type/export", auth, requirePermission("report.read"), validateRequest(z.object({ params: z.object({ type: z.enum(["revenue", "attendance"]) }), query: reportQuery })), async (req, res, next) => { try { const report = await service.exportReport(req.validated.params.type, req.validated.query); res.type("text/csv; charset=utf-8").attachment(report.filename).send(report.content); } catch (error) { next(error); } });
  return router;
}
