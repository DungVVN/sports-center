import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";
import { createSessionToken, generateVerificationCode, hashVerificationCode, readSessionToken, verificationCodeMatches } from "../../shared/auth/session-token.js";
import { hashPassword, verifyPassword } from "../../shared/auth/password.js";
import { createLoginAttemptLimiter } from "../../shared/security/login-attempt-limiter.js";
import { buildTotpUri, createTotpSecret, decryptTotpSecret, encryptTotpSecret, verifyTotp } from "../../shared/auth/totp.js";

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone) {
  return phone.replace(/[\s.-]/g, "");
}

function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.display_name, role: user.role, status: user.status };
}

function ownProfileView({ user, member, staffProfile, contacts }) {
  const isMember = user.role === "member";
  return {
    id: user.id,
    fullName: user.display_name,
    email: user.email,
    avatarUrl: user.avatar_url ?? null,
    role: user.role,
    status: user.status,
    phone: isMember ? member?.phone ?? null : staffProfile?.phone ?? null,
    dateOfBirth: isMember ? member?.date_of_birth ?? null : staffProfile?.date_of_birth ?? null,
    ...(isMember
      ? {
          memberCode: member?.member_code ?? null,
          gender: member?.gender ?? null,
          joinedAt: member?.joined_at ?? null,
          contacts: contacts.map((contact) => ({
            id: contact.id,
            fullName: contact.full_name,
            relationship: contact.relationship,
            phone: contact.phone,
            isPrimary: contact.is_primary,
          })),
        }
      : {
          employeeCode: staffProfile?.employee_code ?? null,
          hiredAt: staffProfile?.hired_at ?? null,
          specialties: staffProfile?.specialties ?? [],
        }),
  };
}

function ensureManager(user) {
  if (user.role !== "manager") throw new AppError({ statusCode: 403, code: "MFA_NOT_REQUIRED", message: "MFA TOTP chỉ áp dụng cho Manager trong giai đoạn pilot." });
}

export function createAuthService({
  repository,
  verificationDelivery,
  auditService = { record: async () => {} },
  loginLimiter = createLoginAttemptLimiter({ maxAttempts: env.authLoginMaxAttempts, windowMinutes: env.authLoginWindowMinutes }),
}) {
  async function issueVerification({ channel, recipient, userId, purpose = "registration" }) {
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + env.verificationCodeTtlMinutes * 60_000);
    const verification = await repository.createVerification({ channel, codeHash: hashVerificationCode(code), expiresAt, userId, purpose });
    const delivery = await verificationDelivery.deliver({ channel, code, recipient, purpose });
    return { challengeId: verification?.id, channel, expiresAt, ...(env.nodeEnv === "development" ? { developmentCode: delivery.developmentCode } : {}) };
  }

  return {
    async register(input) {
      const email = normalizeEmail(input.email);
      const phone = normalizePhone(input.phone);
      const [existingUser, existingMember] = await Promise.all([
        repository.findUserByEmail(email),
        repository.findMemberByEmailOrPhone({ email, phone }),
      ]);
      if (existingUser || existingMember) {
        throw new AppError({ statusCode: 409, code: "ACCOUNT_ALREADY_EXISTS", message: "Email hoặc số điện thoại đã được sử dụng." });
      }

      const registration = await repository.createRegistration({
        email,
        fullName: input.fullName.trim(),
        memberCode: `MBR-${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`,
        passwordHash: await hashPassword(input.password),
        phone,
      });
      await auditService.record({ actorUserId: registration.user.id, action: "member.registration.created", entityType: "member", entityId: registration.member.id, summary: "Hội viên tự đăng ký tài khoản." });
      const verifications = [await issueVerification({ channel: "email", recipient: email, userId: registration.user.id })];
      return { user: publicUser(registration.user), memberId: registration.member.id, verifications };
    },

    async resendVerification({ channel, userId }) {
      const user = await repository.findUserById(userId);
      if (!user) throw new AppError({ statusCode: 404, code: "ACCOUNT_NOT_FOUND", message: "Không tìm thấy tài khoản." });
      if (user.status !== "pending_verification") {
        throw new AppError({ statusCode: 409, code: "VERIFICATION_NOT_REQUIRED", message: "Tài khoản này không còn cần xác thực." });
      }
      const recipient = channel === "email" ? user.email : null;
      if (!recipient) throw new AppError({ statusCode: 422, code: "VERIFICATION_RECIPIENT_UNAVAILABLE", message: "Không tìm thấy thông tin nhận mã xác thực." });
      return issueVerification({ channel, recipient, userId });
    },

    async verifyRegistration({ channel, code, userId }) {
      const verification = await repository.findLatestVerification({ channel, userId });
      if (!verification) throw new AppError({ statusCode: 404, code: "VERIFICATION_NOT_FOUND", message: "Không tìm thấy mã xác thực." });
      if (verification.verified_at) return { status: "already_verified" };
      if (verification.expires_at <= new Date()) throw new AppError({ statusCode: 422, code: "VERIFICATION_EXPIRED", message: "Mã xác thực đã hết hạn." });
      if (verification.attempts >= 5) throw new AppError({ statusCode: 429, code: "VERIFICATION_ATTEMPTS_EXCEEDED", message: "Bạn đã nhập mã quá nhiều lần. Vui lòng yêu cầu mã mới." });

      await repository.incrementVerificationAttempts(verification.id);
      if (!verificationCodeMatches(code, verification.code_hash)) {
        throw new AppError({ statusCode: 422, code: "VERIFICATION_CODE_INVALID", message: "Mã xác thực không chính xác." });
      }
      await repository.markVerificationVerified(verification.id);
      if (channel === "email") {
        await repository.updateUserStatus(userId, "pending_approval");
        await auditService.record({ actorUserId: userId, action: "member.registration.verified", entityType: "user", entityId: userId, summary: "Đã xác thực email, chờ Lễ tân duyệt." });
        return { status: "pending_approval" };
      }
      return { status: "pending_verification" };
    },

    async login({ email: rawEmail, password }) {
      const email = normalizeEmail(rawEmail);
      loginLimiter.assertAllowed(email);
      const user = await repository.findUserByEmail(email);
      if (!user || !await verifyPassword(password, user.password_hash)) {
        loginLimiter.recordFailure(email);
        await auditService.record({ action: "auth.login_failed", entityType: "auth_attempt", summary: "Đăng nhập thất bại." });
        throw new AppError({ statusCode: 401, code: "INVALID_CREDENTIALS", message: "Email hoặc mật khẩu không đúng." });
      }
      if (user.status !== "active") {
        const messageByStatus = {
          pending_verification: "Vui lòng xác thực email trước khi đăng nhập.",
          pending_approval: "Tài khoản đang chờ Lễ tân duyệt.",
          suspended: "Tài khoản đã bị tạm ngưng.",
        };
        throw new AppError({ statusCode: 403, code: "ACCOUNT_NOT_ACTIVE", message: messageByStatus[user.status] ?? "Tài khoản chưa thể đăng nhập." });
      }
      const factor = user.role === "manager" && repository.findTotpFactor ? await repository.findTotpFactor(user.id) : null;
      if (factor) {
        const expiresAt = new Date(Date.now() + env.authMfaChallengeTtlMinutes * 60_000);
        const challenge = await repository.createMfaLoginChallenge({ userId: user.id, expiresAt });
        loginLimiter.clear(email);
        await auditService.record({ actorUserId: user.id, action: "auth.mfa_challenge_created", entityType: "auth_mfa_login_challenge", entityId: challenge.id, summary: "Đã yêu cầu mã Authenticator để hoàn tất đăng nhập." });
        return { mfaRequired: true, mfaChallengeId: challenge.id, expiresAt };
      }
      if (["receptionist", "coach"].includes(user.role)) {
        const verification = await issueVerification({ channel: "email", recipient: user.email, userId: user.id, purpose: "staff_login" });
        await auditService.record({ actorUserId: user.id, action: "auth.staff_email_otp_sent", entityType: "account_verification", entityId: verification.challengeId, summary: "Đã gửi mã email để hoàn tất đăng nhập nhân viên." });
        loginLimiter.clear(email);
        return { emailOtpRequired: true, emailOtpChallengeId: verification.challengeId, expiresAt: verification.expiresAt };
      }
      const expiresAt = new Date(Date.now() + env.authSessionTtlHours * 60 * 60_000);
      const session = await repository.createSession({ expiresAt, userId: user.id });
      loginLimiter.clear(email);
      await auditService.record({
        actorUserId: user.id,
        action: "auth.login_succeeded",
        entityType: "auth_session",
        entityId: session.id,
        summary: "Đăng nhập thành công.",
      });
      const token = await createSessionToken({ sessionId: session.id, userId: user.id, expiresAt });
      const permissions = await repository.getPermissions(user.role);
      return { token, expiresAt, user: publicUser(user), permissions: permissions.map(({ permission_code: permissionCode }) => permissionCode) };
    },

    async beginTotpEnrollment({ userId }) {
      const user = await repository.findUserById(userId);
      if (!user) throw new AppError({ statusCode: 404, code: "ACCOUNT_NOT_FOUND", message: "Không tìm thấy tài khoản." });
      ensureManager(user);
      const secret = createTotpSecret();
      const expiresAt = new Date(Date.now() + env.authMfaEnrollmentTtlMinutes * 60_000);
      const enrollment = await repository.createMfaEnrollment({ userId, secretCiphertext: encryptTotpSecret(secret), expiresAt });
      await auditService.record({ actorUserId: userId, action: "auth.mfa_enrollment_started", entityType: "auth_mfa_enrollment", entityId: enrollment.id, summary: "Đã bắt đầu đăng ký Authenticator." });
      return { enrollmentId: enrollment.id, secret, otpauthUri: buildTotpUri({ secret, email: user.email }), expiresAt };
    },

    async confirmTotpEnrollment({ enrollmentId, code, userId }) {
      const enrollment = await repository.findMfaEnrollment({ enrollmentId, userId });
      if (!enrollment || enrollment.expires_at <= new Date()) throw new AppError({ statusCode: 422, code: "MFA_ENROLLMENT_EXPIRED", message: "Phiên đăng ký MFA không hợp lệ hoặc đã hết hạn." });
      const secret = decryptTotpSecret(enrollment.secret_ciphertext);
      if (!verifyTotp({ secret, code })) throw new AppError({ statusCode: 422, code: "MFA_CODE_INVALID", message: "Mã Authenticator không chính xác." });
      const factor = await repository.activateTotpFactor({ enrollmentId, userId, secretCiphertext: enrollment.secret_ciphertext });
      if (!factor) throw new AppError({ statusCode: 409, code: "MFA_ENROLLMENT_CONSUMED", message: "Phiên đăng ký MFA đã được sử dụng." });
      await auditService.record({ actorUserId: userId, action: "auth.mfa_enrolled", entityType: "auth_totp_factor", entityId: userId, summary: "Đã kích hoạt Authenticator cho Manager." });
      return { enrolled: true };
    },

    async verifyMfaLogin({ challengeId, code }) {
      const challenge = await repository.findMfaLoginChallenge(challengeId);
      if (!challenge) throw new AppError({ statusCode: 422, code: "MFA_CHALLENGE_EXPIRED", message: "Phiên xác thực MFA không hợp lệ hoặc đã hết hạn." });
      const factor = await repository.findTotpFactor(challenge.user_id);
      if (!factor || !verifyTotp({ secret: decryptTotpSecret(factor.secret_ciphertext), code })) {
        throw new AppError({ statusCode: 422, code: "MFA_CODE_INVALID", message: "Mã Authenticator không chính xác." });
      }
      if (!await repository.consumeMfaLoginChallenge(challengeId)) throw new AppError({ statusCode: 409, code: "MFA_CHALLENGE_CONSUMED", message: "Phiên xác thực MFA đã được sử dụng." });
      const user = await repository.findUserById(challenge.user_id);
      if (!user || user.status !== "active") throw new AppError({ statusCode: 401, code: "UNAUTHENTICATED", message: "Tài khoản không còn hoạt động." });
      const expiresAt = new Date(Date.now() + env.authSessionTtlHours * 60 * 60_000);
      const session = await repository.createSession({ expiresAt, userId: user.id });
      const token = await createSessionToken({ sessionId: session.id, userId: user.id, expiresAt });
      const permissions = await repository.getPermissions(user.role);
      await auditService.record({ actorUserId: user.id, action: "auth.mfa_login_succeeded", entityType: "auth_session", entityId: session.id, summary: "Đăng nhập Manager hoàn tất bằng Authenticator." });
      return { token, expiresAt, user: publicUser(user), permissions: permissions.map(({ permission_code: permissionCode }) => permissionCode) };
    },

    async verifyStaffEmailOtp({ challengeId, code }) {
      const verification = await repository.findVerification({ verificationId: challengeId, purpose: "staff_login" });
      if (!verification || verification.verified_at || verification.expires_at <= new Date()) throw new AppError({ statusCode: 422, code: "EMAIL_OTP_EXPIRED", message: "Mã đăng nhập không hợp lệ hoặc đã hết hạn." });
      if (verification.attempts >= 5) throw new AppError({ statusCode: 429, code: "EMAIL_OTP_ATTEMPTS_EXCEEDED", message: "Bạn đã nhập mã quá nhiều lần. Vui lòng đăng nhập lại để nhận mã mới." });
      await repository.incrementVerificationAttempts(verification.id);
      if (!verificationCodeMatches(code, verification.code_hash)) throw new AppError({ statusCode: 422, code: "EMAIL_OTP_INVALID", message: "Mã đăng nhập không chính xác." });
      const consumed = await repository.markVerificationVerifiedOnce(verification.id);
      if (!consumed || consumed.count !== 1) throw new AppError({ statusCode: 409, code: "EMAIL_OTP_CONSUMED", message: "Mã đăng nhập đã được sử dụng." });
      const user = await repository.findUserById(verification.user_id);
      if (!user || user.status !== "active" || !["receptionist", "coach"].includes(user.role)) throw new AppError({ statusCode: 401, code: "UNAUTHENTICATED", message: "Tài khoản không còn hoạt động." });
      const expiresAt = new Date(Date.now() + env.authSessionTtlHours * 60 * 60_000);
      const session = await repository.createSession({ expiresAt, userId: user.id });
      const token = await createSessionToken({ sessionId: session.id, userId: user.id, expiresAt });
      const permissions = await repository.getPermissions(user.role);
      await auditService.record({ actorUserId: user.id, action: "auth.staff_email_otp_succeeded", entityType: "auth_session", entityId: session.id, summary: "Đăng nhập nhân viên hoàn tất bằng mã email." });
      return { token, expiresAt, user: publicUser(user), permissions: permissions.map(({ permission_code: permissionCode }) => permissionCode) };
    },

    async logout(token) {
      const { sessionId } = await readSessionToken(token);
      await repository.revokeSession(sessionId);
    },

    async changePassword({ currentPassword, newPassword, userId }) {
      const user = await repository.userCredentials(userId);
      if (!user || !await verifyPassword(currentPassword, user.password_hash)) throw new AppError({ statusCode: 422, code: "CURRENT_PASSWORD_INVALID", message: "Mật khẩu hiện tại không đúng." });
      await repository.updatePassword(userId, await hashPassword(newPassword));
      await repository.revokeUserSessions(userId);
      await auditService.record({ actorUserId: userId, action: "auth.password_changed", entityType: "user", entityId: userId, summary: "Đã đổi mật khẩu và thu hồi các phiên đăng nhập." });
    },

    async getAuthentication(token) {
      const claims = await readSessionToken(token);
      const authenticated = await repository.findSessionUser(claims.sessionId, claims.userId);
      if (!authenticated || authenticated.user.status !== "active") {
        throw new AppError({ statusCode: 401, code: "UNAUTHENTICATED", message: "Phiên đăng nhập không còn hiệu lực." });
      }
      const permissions = await repository.getPermissions(authenticated.user.role);
      return {
        sessionId: authenticated.session.id,
        user: publicUser(authenticated.user),
        permissions: permissions.map(({ permission_code: permissionCode }) => permissionCode),
      };
    },

    async getMe(token) {
      const authentication = await this.getAuthentication(token);
      return { user: authentication.user, permissions: authentication.permissions };
    },

    async getOwnProfile(userId) {
      const profile = await repository.findOwnProfile(userId);
      if (!profile) throw new AppError({ statusCode: 404, code: "PROFILE_NOT_FOUND", message: "Không tìm thấy hồ sơ cá nhân." });
      return ownProfileView(profile);
    },

    async updateOwnProfile({ input, userId }) {
      const before = await this.getOwnProfile(userId);
      await repository.updateOwnProfile(userId, input);
      const updated = await this.getOwnProfile(userId);
      await auditService.record({
        actorUserId: userId,
        action: "profile.updated",
        entityType: before.role === "member" ? "member" : "staff_profile",
        entityId: userId,
        summary: "Đã cập nhật hồ sơ cá nhân.",
        previousValue: { fullName: before.fullName, phone: before.phone, dateOfBirth: before.dateOfBirth, gender: before.gender ?? null },
        newValue: { fullName: updated.fullName, phone: updated.phone, dateOfBirth: updated.dateOfBirth, gender: updated.gender ?? null },
      });
      return updated;
    },

    listPendingRegistrations() {
      return repository.listPendingRegistrations();
    },

    async approveRegistration({ approvedBy, userId }) {
      const approved = await repository.approveRegistration({ approvedBy, userId });
      if (!approved) throw new AppError({ statusCode: 404, code: "ACCOUNT_NOT_FOUND", message: "Không tìm thấy đăng ký hội viên." });
      if (!approved.approved) throw new AppError({ statusCode: 409, code: "REGISTRATION_NOT_PENDING", message: "Tài khoản không ở trạng thái chờ duyệt." });
      await auditService.record({ actorUserId: approvedBy, action: "member.registration.approved", entityType: "member", entityId: approved.member.id, summary: "Lễ tân đã duyệt tài khoản hội viên.", newValue: { userStatus: "active" } });
      return { user: publicUser(approved.user), member: approved.member };
    },
  };
}
