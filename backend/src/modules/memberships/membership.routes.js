import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
import { validateRequest } from "../../shared/validation/validate-request.js";

const id = z.string().uuid();
const entitlement = z.object({ code: z.enum(["gym_access", "group_class_booking", "pool_access", "sauna_access", "towel_service", "premium_locker", "pt_session"]), usageLimit: z.number().int().positive().nullable().optional(), limitPeriod: z.enum(["weekly", "monthly"]).nullable().optional() });
const packageCreate = z.object({ code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/), name: z.string().trim().min(2).max(100), priceVnd: z.coerce.number().int().nonnegative(), durationDays: z.coerce.number().int().positive().max(730), tierRank: z.coerce.number().int().positive(), benefits: z.array(z.string().trim().min(1).max(200)).max(20).optional(), entitlements: z.array(entitlement).max(20).optional(), isActive: z.boolean().optional() });
const packageUpdate = packageCreate.partial().omit({ code: true });

export function createMembershipRouter(service, authService) {
  const router = Router(); const read = [authenticate(authService), requirePermission("member.read")]; const assign = [authenticate(authService), requirePermission("membership.assign")]; const packageManage = [authenticate(authService), requirePermission("membership.package.manage")]; const freezeRequest = [authenticate(authService), requirePermission("membership.freeze.request")];
  router.get("/membership-packages", authenticate(authService), requirePermission("membership.package.read"), async (req, res, next) => { try { sendSuccess(res, { data: await service.listPackages() }); } catch (error) { next(error); } });
  router.post("/membership-packages", ...packageManage, validateRequest(z.object({ body: packageCreate })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.createPackage(req.validated.body, req.auth.user.id) }); } catch (error) { next(error); } });
  router.get("/membership-freeze-requests", authenticate(authService), requirePermission("membership.freeze.review"), validateRequest(z.object({ query: z.object({ status: z.enum(["pending", "approved", "rejected"]).optional() }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.freezeRequests(req.validated.query.status) }); } catch (error) { next(error); } });
  router.patch("/membership-packages/:id", ...packageManage, validateRequest(z.object({ params: z.object({ id }), body: packageUpdate })), async (req, res, next) => { try { sendSuccess(res, { data: await service.updatePackage(req.validated.params.id, req.validated.body, req.auth.user.id) }); } catch (error) { next(error); } });
  router.post("/members/:id/memberships", ...assign, validateRequest(z.object({ params: z.object({ id }), body: z.object({ packageId: id, startsOn: z.string().date() }) })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.createMemberMembership({ memberId: req.validated.params.id, ...req.validated.body }, req.auth.user.id) }); } catch (error) { next(error); } });
  router.get("/members/me/memberships", authenticate(authService), requirePermission("membership.self.read"), async (req, res, next) => { try { sendSuccess(res, { data: await service.listOwnMemberships(req.auth.user) }); } catch (error) { next(error); } });
  router.get("/members/:id/memberships", ...read, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.listMemberMemberships(req.validated.params.id) }); } catch (error) { next(error); } });
  router.post("/memberships/:id/freeze-requests", ...freezeRequest, validateRequest(z.object({ params: z.object({ id }), body: z.object({ startsOn: z.string().date(), endsOn: z.string().date(), reason: z.string().trim().min(3).max(500) }) })), async (req, res, next) => { try { sendSuccess(res, { statusCode: 201, data: await service.requestFreeze(req.validated.params.id, req.validated.body, req.auth.user) }); } catch (error) { next(error); } });
  router.patch("/membership-freeze-requests/:id", authenticate(authService), requirePermission("membership.freeze.review"), validateRequest(z.object({ params: z.object({ id }), body: z.object({ approved: z.boolean() }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.reviewFreeze(req.validated.params.id, req.validated.body.approved, req.auth.user.id) }); } catch (error) { next(error); } });
  router.patch("/memberships/:id/cancel-pending-renewal", ...assign, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => { try { sendSuccess(res, { data: await service.cancelPendingRenewal(req.validated.params.id, req.auth.user.id) }); } catch (error) { next(error); } });
  return router;
}
