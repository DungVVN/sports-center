import { Router } from "express";
import { z } from "zod";
import { authenticate, requirePermission } from "../../../shared/auth/authentication.middleware.js";
import { sendSuccess } from "../../../shared/http/response.js";
import { validateRequest } from "../../../shared/validation/validate-request.js";
import { portalSurfaceFromRequest, sessionCookieNames, sessionCookieOptions } from "../../../shared/auth/portal-session.js";

const id = z.string().uuid();
const registrationSchema = z.object({ body: z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().regex(/^(?:\+84|0)\d{9,10}$/, "Số điện thoại Việt Nam chưa hợp lệ."),
  password: z.string().min(8).max(72).regex(/[a-z]/, "Mật khẩu cần có chữ thường.").regex(/[A-Z]/, "Mật khẩu cần có chữ hoa.").regex(/\d/, "Mật khẩu cần có chữ số."),
  captchaToken: z.string().min(1).max(4096).optional(),
}) });
const verificationSchema = z.object({ body: z.object({ userId: id, channel: z.literal("email"), code: z.string().regex(/^\d{6}$/) }) });
const resendSchema = z.object({ body: z.object({ userId: id, channel: z.literal("email") }) });
const loginSchema = z.object({ body: z.object({ email: z.string().trim().email(), password: z.string().min(1).max(72), captchaToken: z.string().min(1).max(4096).optional() }) });
const mfaCode = z.string().regex(/^\d{6}$/);
const mfaEnrollmentConfirmSchema = z.object({ body: z.object({ enrollmentId: id, code: mfaCode }) });
const mfaLoginSchema = z.object({ body: z.object({ challengeId: id, code: mfaCode }) });
const passwordSchema = z.object({ body: z.object({ currentPassword: z.string().min(1).max(72), newPassword: z.string().min(8).max(72).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/) }) });
const userIdParams = z.object({ params: z.object({ userId: id }) });
const ownProfileSchema = z.object({ body: z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^(?:\+84|0)\d{9,10}$/, "Số điện thoại Việt Nam chưa hợp lệ."),
  dateOfBirth: z.string().date().nullable(),
  avatarUrl: z.string().url("Đường dẫn ảnh đại diện không hợp lệ.").max(2048).nullable().optional(),
  gender: z.string().trim().max(30).nullable().optional(),
  contacts: z.array(z.object({ fullName: z.string().trim().min(2).max(120), relationship: z.string().trim().min(2).max(60), phone: z.string().trim().regex(/^(?:\+84|0)\d{9,10}$/, "Số điện thoại Việt Nam chưa hợp lệ."), isPrimary: z.boolean() })).max(3).optional(),
}).refine((input) => !input.contacts || input.contacts.filter((contact) => contact.isPrimary).length <= 1, { message: "Chỉ được chọn một liên hệ khẩn cấp chính.", path: ["contacts"] }) });

function sessionCookie(response, token, surface = "main") {
  response.cookie(sessionCookieNames[surface], token, sessionCookieOptions());
}

export function createAuthRouter(authService, cloudinaryMediaService) {
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
      const session = await authService.login({ ...request.validated.body, loginSurface: "main" });
      if (session.mfaRequired) {
        return sendSuccess(response, { data: { mfaRequired: true, challengeId: session.mfaChallengeId, expiresAt: session.expiresAt } });
      }
      sessionCookie(response, session.token);
      sendSuccess(response, { data: { user: session.user, permissions: session.permissions, expiresAt: session.expiresAt } });
    } catch (error) { next(error); }
  });
  router.post("/admin/login", validateRequest(loginSchema), async (request, response, next) => {
    try {
      const session = await authService.login({ ...request.validated.body, loginSurface: "admin" });
      if (session.mfaRequired) {
        return sendSuccess(response, { data: { mfaRequired: true, challengeId: session.mfaChallengeId, expiresAt: session.expiresAt } });
      }
      sessionCookie(response, session.token, "admin");
      sendSuccess(response, { data: { user: session.user, permissions: session.permissions, expiresAt: session.expiresAt } });
    } catch (error) { next(error); }
  });
  router.post("/mfa/totp/enrollment", authRequired, async (request, response, next) => {
    try { sendSuccess(response, { statusCode: 201, data: await authService.beginTotpEnrollment({ userId: request.auth.user.id }) }); } catch (error) { next(error); }
  });
  router.post("/mfa/totp/enrollment/confirm", authRequired, validateRequest(mfaEnrollmentConfirmSchema), async (request, response, next) => {
    try { sendSuccess(response, { data: await authService.confirmTotpEnrollment({ ...request.validated.body, userId: request.auth.user.id }) }); } catch (error) { next(error); }
  });
  router.post("/mfa/totp/verify", validateRequest(mfaLoginSchema), async (request, response, next) => {
    try {
      const session = await authService.verifyMfaLogin({ ...request.validated.body, loginSurface: "main" });
      sessionCookie(response, session.token);
      sendSuccess(response, { data: { user: session.user, permissions: session.permissions, expiresAt: session.expiresAt } });
    } catch (error) { next(error); }
  });
  router.post("/admin/mfa/totp/verify", validateRequest(mfaLoginSchema), async (request, response, next) => {
    try {
      const session = await authService.verifyMfaLogin({ ...request.validated.body, loginSurface: "admin" });
      sessionCookie(response, session.token, "admin");
      sendSuccess(response, { data: { user: session.user, permissions: session.permissions, expiresAt: session.expiresAt } });
    } catch (error) { next(error); }
  });
  router.post("/mfa/email/verify", validateRequest(mfaLoginSchema), async (request, response, next) => {
    try {
      const session = await authService.verifyStaffEmailOtp(request.validated.body);
      sessionCookie(response, session.token);
      sendSuccess(response, { data: { user: session.user, permissions: session.permissions, expiresAt: session.expiresAt } });
    } catch (error) { next(error); }
  });
  router.post("/logout", authRequired, async (request, response, next) => {
    try {
      await authService.logout(request.auth.token);
      response.clearCookie(sessionCookieNames[portalSurfaceFromRequest(request)], sessionCookieOptions());
      sendSuccess(response, { data: { loggedOut: true } });
    } catch (error) { next(error); }
  });
  router.post("/password/change", authRequired, validateRequest(passwordSchema), async (request, response, next) => { try { const result = await authService.changePassword({ ...request.validated.body, userId: request.auth.user.id, currentSessionId: request.auth.sessionId }); sendSuccess(response, { data: { changed: true, ...result } }); } catch (error) { next(error); } });
  router.get("/me", authRequired, (request, response) => sendSuccess(response, { data: { user: request.auth.user, permissions: request.auth.permissions } }));
  router.get("/profile", authRequired, async (request, response, next) => {
    try { sendSuccess(response, { data: await authService.getOwnProfile(request.auth.user.id) }); } catch (error) { next(error); }
  });
  router.post("/profile/avatar/cloudinary/signature", authRequired, async (_request, response, next) => {
    try { sendSuccess(response, { data: cloudinaryMediaService.createProfileUploadSignature() }); } catch (error) { next(error); }
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
