import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { authenticate, requirePermission } from "../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../shared/http/response.js";
import { validateRequest } from "../../shared/validation/validate-request.js";

const id = z.string().uuid();
const registrationSchema = z.object({ body: z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().regex(/^(?:\+84|0)\d{9,10}$/, "Số điện thoại Việt Nam chưa hợp lệ."),
  password: z.string().min(8).max(72).regex(/[a-z]/, "Mật khẩu cần có chữ thường.").regex(/[A-Z]/, "Mật khẩu cần có chữ hoa.").regex(/\d/, "Mật khẩu cần có chữ số."),
}) });
const verificationSchema = z.object({ body: z.object({ userId: id, channel: z.enum(["email", "phone"]), code: z.string().regex(/^\d{6}$/) }) });
const resendSchema = z.object({ body: z.object({ userId: id, channel: z.enum(["email", "phone"]) }) });
const loginSchema = z.object({ body: z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72) }) });
const userIdParams = z.object({ params: z.object({ userId: id }) });
const ownProfileSchema = z.object({ body: z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^(?:\+84|0)\d{9,10}$/, "Số điện thoại Việt Nam chưa hợp lệ."),
  dateOfBirth: z.string().date().nullable(),
  avatarUrl: z.string().url("Đường dẫn ảnh đại diện không hợp lệ.").max(2048).nullable().optional(),
  gender: z.string().trim().max(30).nullable().optional(),
  contacts: z.array(z.object({ fullName: z.string().trim().min(2).max(120), relationship: z.string().trim().min(2).max(60), phone: z.string().trim().regex(/^(?:\+84|0)\d{9,10}$/, "Số điện thoại Việt Nam chưa hợp lệ."), isPrimary: z.boolean() })).max(3).optional(),
}).refine((input) => !input.contacts || input.contacts.filter((contact) => contact.isPrimary).length <= 1, { message: "Chỉ được chọn một liên hệ khẩn cấp chính.", path: ["contacts"] }) });

function sessionCookie(response, token, expiresAt) {
  response.cookie("sports_center_session", token, {
    httpOnly: true,
    // Vercel and Render have different sites. Browsers only attach this
    // cross-site session cookie to fetch requests when it is SameSite=None.
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    expires: expiresAt,
    path: env.apiBasePath,
  });
}

export function createAuthRouter(authService) {
  const router = Router();
  const authRequired = authenticate(authService);

  router.post("/register", validateRequest(registrationSchema), async (request, response, next) => {
    try { sendSuccess(response, { statusCode: 201, data: await authService.register(request.validated.body) }); } catch (error) { next(error); }
  });
  router.post("/verification/confirm", validateRequest(verificationSchema), async (request, response, next) => {
    try { sendSuccess(response, { data: await authService.verifyRegistration(request.validated.body) }); } catch (error) { next(error); }
  });
  router.post("/verification/resend", validateRequest(resendSchema), async (request, response, next) => {
    try { sendSuccess(response, { data: await authService.resendVerification(request.validated.body) }); } catch (error) { next(error); }
  });
  router.post("/login", validateRequest(loginSchema), async (request, response, next) => {
    try {
      const session = await authService.login(request.validated.body);
      sessionCookie(response, session.token, session.expiresAt);
      sendSuccess(response, { data: { user: session.user, expiresAt: session.expiresAt } });
    } catch (error) { next(error); }
  });
  router.post("/logout", authRequired, async (request, response, next) => {
    try {
      await authService.logout(request.auth.token);
      response.clearCookie("sports_center_session", { httpOnly: true, sameSite: env.nodeEnv === "production" ? "none" : "lax", secure: env.nodeEnv === "production", path: env.apiBasePath });
      sendSuccess(response, { data: { loggedOut: true } });
    } catch (error) { next(error); }
  });
  router.get("/me", authRequired, (request, response) => sendSuccess(response, { data: { user: request.auth.user, permissions: request.auth.permissions } }));
  router.get("/profile", authRequired, async (request, response, next) => {
    try { sendSuccess(response, { data: await authService.getOwnProfile(request.auth.user.id) }); } catch (error) { next(error); }
  });
  router.patch("/profile", authRequired, validateRequest(ownProfileSchema), async (request, response, next) => {
    try { sendSuccess(response, { data: await authService.updateOwnProfile({ userId: request.auth.user.id, input: request.validated.body }) }); } catch (error) { next(error); }
  });
  router.get("/registrations/pending", authRequired, requirePermission("registration.approve"), async (request, response, next) => {
    try { sendSuccess(response, { data: await authService.listPendingRegistrations() }); } catch (error) { next(error); }
  });
  router.post("/registrations/:userId/approve", validateRequest(userIdParams), authRequired, requirePermission("registration.approve"), async (request, response, next) => {
    try { sendSuccess(response, { data: await authService.approveRegistration({ approvedBy: request.auth.user.id, userId: request.validated.params.userId }) }); } catch (error) { next(error); }
  });
  return router;
}
