import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../../shared/errors/app-error.js";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";
const id = z.string().uuid();
const phone = z.string().min(9, "Nhập số điện thoại từ 9 đến 20 ký tự, ví dụ 0901234567.").max(20, "Số điện thoại tối đa 20 ký tự, ví dụ 0901234567.");
const contact = z.object({
  fullName: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(2).max(60),
  phone: phone,
  isPrimary: z.boolean().default(false),
});
const base = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().email().optional().nullable(),
  phone: phone.optional(),
  dateOfBirth: z.string().date().optional().nullable(),
  gender: z.string().max(30).optional().nullable(),
});
const createBody = base.extend({
  fullName: z.string().trim().min(2).max(120),
  phone: phone,
  contacts: z.array(contact).max(3).default([]),
  createAccount: z.boolean().default(false),
}).superRefine((input, context) => {
  if (input.createAccount && !input.email) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Cần email để tạo tài khoản và gửi mật khẩu tạm." });
  }
});

export function createMemberRouter(service, authService) {
  const router = Router();
  const auth = authenticate(authService);
  const read = [auth, requirePermission("member.read")];
  const write = [auth, requirePermission("member.write")];
  const credentials = [auth, requirePermission("member.credentials.reset"), (req, _res, next) => {
    if (req.auth.user.role === "member") {
      return next(new AppError({ statusCode: 403, code: "FORBIDDEN", message: "Hội viên không được cấp lại mật khẩu tài khoản khác." }));
    }
    return next();
  }];

  router.get("/me", auth, async (req, res, next) => {
    try { sendSuccess(res, { data: await service.getByUserId(req.auth.user.id) }); } catch (error) { next(error); }
  });
  router.get("/", ...read, async (req, res, next) => {
    try { sendSuccess(res, { data: await service.list() }); } catch (error) { next(error); }
  });
  router.post("/", ...write, validateRequest(z.object({ body: createBody })), async (req, res, next) => {
    try { sendSuccess(res, { statusCode: 201, data: await service.create(req.validated.body, req.auth.user.id) }); } catch (error) { next(error); }
  });
  router.post("/:id/account-credentials", ...credentials, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => {
    try { sendSuccess(res, { data: await service.issueAccountCredentials(req.validated.params.id, req.auth.user.id) }); } catch (error) { next(error); }
  });
  router.get("/:id", ...read, validateRequest(z.object({ params: z.object({ id }) })), async (req, res, next) => {
    try { sendSuccess(res, { data: await service.get(req.validated.params.id) }); } catch (error) { next(error); }
  });
  router.patch("/:id", ...write, validateRequest(z.object({ params: z.object({ id }), body: base })), async (req, res, next) => {
    try { sendSuccess(res, { data: await service.update(req.validated.params.id, req.validated.body, req.auth.user.id) }); } catch (error) { next(error); }
  });
  router.put("/:id/emergency-contacts", ...write, validateRequest(z.object({
    params: z.object({ id }),
    body: z.object({ contacts: z.array(contact).max(3) }),
  })), async (req, res, next) => {
    try { sendSuccess(res, { data: await service.replaceContacts(req.validated.params.id, req.validated.body.contacts, req.auth.user.id) }); } catch (error) { next(error); }
  });

  return router;
}
