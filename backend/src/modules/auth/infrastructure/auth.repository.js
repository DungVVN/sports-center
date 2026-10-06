import { prisma } from "../../../database.js";
import { AppError } from "../../../shared/errors/app-error.js";
import { invalidateLoginChallenges } from "../../../shared/auth/invalidate-login-challenges.js";

export const authRepository = {
  findUserByEmail(email) {
    return prisma.users.findUnique({ where: { email } });
  },

  findUserById(id) {
    return prisma.users.findUnique({ where: { id } });
  },

  async findOwnProfile(userId) {
    const user = await this.findUserById(userId);
    if (!user) return null;
    const [member, staffProfile] = await Promise.all([
      prisma.members.findUnique({ where: { user_id: userId } }),
      prisma.staff_profiles.findUnique({ where: { user_id: userId } }),
    ]);
    const contacts = member
      ? await prisma.member_emergency_contacts.findMany({
          where: { member_id: member.id },
          orderBy: [{ is_primary: "desc" }, { full_name: "asc" }],
        })
      : [];
    return { user, member, staffProfile, contacts };
  },

  async updateOwnProfile(userId, input) {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.users.update({
        where: { id: userId },
        data: { display_name: input.fullName, avatar_url: input.avatarUrl ?? null, profile_setup_required: false },
      });
      if (user.role === "member") {
        const member = await transaction.members.update({
          where: { user_id: userId },
          data: {
            full_name: input.fullName,
            phone: input.phone,
            date_of_birth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
            gender: input.gender ?? null,
          },
        });
        if (input.contacts) {
          await transaction.member_emergency_contacts.deleteMany({ where: { member_id: member.id } });
          if (input.contacts.length) {
            await transaction.member_emergency_contacts.createMany({
              data: input.contacts.map((contact) => ({ full_name: contact.fullName, relationship: contact.relationship, phone: contact.phone, is_primary: contact.isPrimary, member_id: member.id })),
            });
          }
        }
      } else {
        await transaction.staff_profiles.update({
          where: { user_id: userId },
          data: {
            phone: input.phone,
            date_of_birth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          },
        });
      }
      return user;
    });
  },

  findMemberByUserId(userId) {
    return prisma.members.findUnique({ where: { user_id: userId } });
  },

  async findMemberByEmailOrPhone({ email, phone }) {
    return prisma.members.findFirst({ where: { OR: [{ email }, { phone }] } });
  },

  createRegistration({ email, fullName, memberCode, passwordHash, phone }) {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.users.create({
        data: {
          email,
          password_hash: passwordHash,
          display_name: fullName,
          role: "member",
          status: "pending_verification",
          profile_setup_required: true,
        },
      });
      const member = await transaction.members.create({
        data: {
          user_id: user.id,
          member_code: memberCode,
          full_name: fullName,
          email,
          phone,
        },
      });
      return { user, member };
    });
  },

  createVerification({ channel, codeHash, expiresAt, userId, purpose = "registration" }) {
    return prisma.account_verifications.create({
      data: { channel, code_hash: codeHash, expires_at: expiresAt, user_id: userId, purpose },
    });
  },

  findLatestVerification({ channel, userId }) {
    return prisma.account_verifications.findFirst({
      where: { channel, purpose: "registration", user_id: userId },
      orderBy: { created_at: "desc" },
    });
  },

  incrementVerificationAttempts(id) {
    return prisma.account_verifications.updateMany({
      where: { id, verified_at: null, expires_at: { gt: new Date() }, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
  },

  async completeRegistrationVerification({ verificationId, userId, channel }) {
    return prisma.$transaction(async (transaction) => {
      const now = new Date();
      const consumed = await transaction.account_verifications.updateMany({
        where: { id: verificationId, user_id: userId, channel, purpose: "registration", verified_at: null, expires_at: { gt: now }, attempts: { lte: 5 } },
        data: { verified_at: now },
      });
      if (consumed.count !== 1) return false;
      if (channel === "email") {
        const updated = await transaction.users.updateMany({ where: { id: userId, role: "member", status: "pending_verification" }, data: { status: "pending_approval" } });
        if (updated.count !== 1) throw new AppError({ statusCode: 409, code: "REGISTRATION_NOT_PENDING", message: "Tài khoản không còn chờ xác thực." });
        await transaction.audit_logs.create({ data: {
          actor_user_id: userId, action: "member.registration.verified", entity_type: "user", entity_id: userId,
          summary: "Đã xác thực email, chờ Lễ tân duyệt.",
        } });
      }
      return true;
    });
  },

  expireActiveVerifications({ userId, purpose }) {
    return prisma.account_verifications.updateMany({
      where: { user_id: userId, purpose, verified_at: null, expires_at: { gt: new Date() } },
      data: { expires_at: new Date() },
    });
  },

  markVerificationVerifiedOnce(id) {
    return prisma.account_verifications.updateMany({ where: { id, verified_at: null, expires_at: { gt: new Date() }, attempts: { lte: 5 } }, data: { verified_at: new Date() } });
  },

  async areRegistrationChannelsVerified(userId) {
    const channels = await Promise.all(["email", "phone"].map((channel) => prisma.account_verifications.findFirst({
      where: { channel, purpose: "registration", user_id: userId },
      orderBy: { created_at: "desc" },
    })));
    return channels.every((verification) => verification?.verified_at);
  },

  async createSession({ expiresAt, userId, expectedPasswordHash, mfaChallengeId, expectedFactorCiphertext, emailVerificationId, loginSurface = "main" }) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await transaction.users.findUnique({ where: { id: userId } });
      const reject = () => { throw new AppError({ statusCode: 401, code: "UNAUTHENTICATED", message: "Thông tin đăng nhập đã thay đổi hoặc hết hạn. Vui lòng đăng nhập lại." }); };
      if (!user || user.status !== "active" || (user.role === "admin") !== (loginSurface === "admin")) reject();
      if (expectedPasswordHash !== undefined && user.password_hash !== expectedPasswordHash) reject();
      if (!mfaChallengeId && await transaction.auth_totp_factors.findUnique({ where: { user_id: userId } })) reject();
      if (mfaChallengeId) {
        const challenge = await transaction.auth_mfa_login_challenges.findUnique({ where: { id: mfaChallengeId } });
        const factor = await transaction.auth_totp_factors.findUnique({ where: { user_id: userId } });
        if (!challenge || challenge.user_id !== userId || !challenge.used_at || challenge.expires_at <= new Date()
          || challenge.login_surface !== loginSurface || !factor || factor.secret_ciphertext !== expectedFactorCiphertext) reject();
      }
      if (emailVerificationId) {
        const verification = await transaction.account_verifications.findUnique({ where: { id: emailVerificationId } });
        if (!["receptionist", "coach"].includes(user.role) || !verification || verification.user_id !== userId || verification.purpose !== "staff_login" || !verification.verified_at || verification.expires_at <= new Date()) reject();
      }
      return transaction.auth_sessions.create({ data: { expires_at: expiresAt, user_id: userId } });
    });
  },

  findVerification({ verificationId, purpose }) {
    return prisma.account_verifications.findFirst({ where: { id: verificationId, purpose } });
  },

  findTotpFactor(userId) {
    return prisma.auth_totp_factors.findUnique({ where: { user_id: userId } });
  },

  createMfaEnrollment({ userId, secretCiphertext, expiresAt }) {
    return prisma.auth_mfa_enrollments.create({ data: { user_id: userId, secret_ciphertext: secretCiphertext, expires_at: expiresAt } });
  },

  findMfaEnrollment({ enrollmentId, userId }) {
    return prisma.auth_mfa_enrollments.findFirst({ where: { id: enrollmentId, user_id: userId, consumed_at: null } });
  },

  async activateTotpFactor({ enrollmentId, userId, secretCiphertext }) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const consumed = await transaction.auth_mfa_enrollments.updateMany({ where: { id: enrollmentId, user_id: userId, consumed_at: null, expires_at: { gt: new Date() } }, data: { consumed_at: new Date() } });
      if (consumed.count !== 1) return null;
      const factor = await transaction.auth_totp_factors.upsert({ where: { user_id: userId }, create: { user_id: userId, secret_ciphertext: secretCiphertext }, update: { secret_ciphertext: secretCiphertext } });
      await transaction.auth_sessions.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } });
      await invalidateLoginChallenges(transaction, userId);
      await transaction.audit_logs.create({ data: { actor_user_id: userId, action: "auth.mfa_enrolled", entity_type: "auth_totp_factor", entity_id: userId, summary: "Đã kích hoạt Authenticator cho tài khoản." } });
      return factor;
    });
  },

  createMfaLoginChallenge({ userId, expiresAt, expectedPasswordHash, expectedFactorCiphertext, loginSurface = "main" }) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await transaction.users.findUnique({ where: { id: userId } });
      const factor = await transaction.auth_totp_factors.findUnique({ where: { user_id: userId } });
      if (!user || user.status !== "active" || user.password_hash !== expectedPasswordHash
        || (user.role === "admin") !== (loginSurface === "admin") || !factor || factor.secret_ciphertext !== expectedFactorCiphertext) {
        throw new AppError({ statusCode: 401, code: "UNAUTHENTICATED", message: "Thông tin đăng nhập đã thay đổi. Vui lòng đăng nhập lại." });
      }
      return transaction.auth_mfa_login_challenges.create({ data: { user_id: userId, expires_at: expiresAt, login_surface: loginSurface } });
    });
  },

  async findMfaLoginChallenge(challengeId) {
    return prisma.auth_mfa_login_challenges.findFirst({ where: { id: challengeId, used_at: null } });
  },

  async consumeMfaLoginChallenge(challengeId) {
    const challenge = await this.findMfaLoginChallenge(challengeId);
    if (!challenge || challenge.expires_at <= new Date()) return null;
    const consumed = await prisma.auth_mfa_login_challenges.updateMany({ where: { id: challengeId, user_id: challenge.user_id, used_at: null, expires_at: { gt: new Date() } }, data: { used_at: new Date() } });
    return consumed.count === 1 ? challenge : null;
  },

  revokeSession(sessionId) {
    return prisma.auth_sessions.updateMany({ where: { id: sessionId, revoked_at: null }, data: { revoked_at: new Date() } });
  },

  userCredentials(userId) { return prisma.users.findUnique({ where: { id: userId }, select: { id: true, password_hash: true, must_change_password: true } }); },
  async changePasswordAndRevokeSessions({ userId, passwordHash, expectedPasswordHash, currentSessionId }) {
    return prisma.$transaction(async (transaction) => {
      const updated = await transaction.users.updateMany({
        where: { id: userId, status: "active", password_hash: expectedPasswordHash },
        data: { password_hash: passwordHash, must_change_password: false },
      });
      if (updated.count !== 1) throw new AppError({ statusCode: 409, code: "PASSWORD_CHANGE_CONFLICT", message: "Tài khoản hoặc mật khẩu đã thay đổi. Vui lòng đăng nhập lại." });
      await transaction.auth_sessions.updateMany({
        where: { user_id: userId, ...(currentSessionId ? { id: { not: currentSessionId } } : {}), revoked_at: null },
        data: { revoked_at: new Date() },
      });
      await invalidateLoginChallenges(transaction, userId);
      await transaction.audit_logs.create({ data: {
        actor_user_id: userId, action: "auth.password_changed", entity_type: "user", entity_id: userId,
        summary: "Đã đổi mật khẩu và thu hồi các phiên đăng nhập.",
      } });
    });
  },
  revokeUserSessions(userId) { return prisma.auth_sessions.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } }); },

  async findSessionUser(sessionId, userId) {
    const now = new Date();
    const session = await prisma.auth_sessions.findUnique({ where: { id: sessionId } });
    if (!session || session.user_id !== userId || session.revoked_at || session.expires_at <= now) return null;
    const user = await prisma.users.findUnique({ where: { id: userId }, select: {
      id: true, email: true, display_name: true, role: true, status: true, must_change_password: true, profile_setup_required: true,
    } });
    if (!user || user.status !== "active") return null;
    // Keep revocation/role checks live; only the activity timestamp is throttled.
    const activityCutoff = new Date(now.getTime() - 5 * 60_000);
    if (session.last_seen_at <= activityCutoff) {
      await prisma.auth_sessions.updateMany({
        where: { id: sessionId, revoked_at: null, expires_at: { gt: now }, last_seen_at: { lte: activityCutoff } },
        data: { last_seen_at: now },
      });
    }
    return { session, user };
  },

  getPermissions(role) {
    if (role === "admin") {
      return prisma.permissions.findMany({ select: { code: true } })
        .then((permissions) => permissions.map(({ code }) => ({ permission_code: code })));
    }
    return prisma.role_permissions.findMany({
      where: { role_code: role },
      select: { permission_code: true },
    });
  },

  async listPendingRegistrations() {
    const users = await prisma.users.findMany({
      where: { role: "member", status: "pending_approval" },
      select: { id: true, email: true, display_name: true, role: true, status: true, created_at: true },
      orderBy: { created_at: "asc" },
    });
    const members = users.length ? await prisma.members.findMany({ where: { user_id: { in: users.map((user) => user.id) } }, select: { id: true, user_id: true, member_code: true, full_name: true, phone: true } }) : [];
    const memberByUserId = new Map(members.map((member) => [member.user_id, member]));
    return users.map((user) => ({ user, member: memberByUserId.get(user.id) ?? null }));
  },

  async approveRegistration({ approvedBy, userId }) {
    return prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      const user = await transaction.users.findUnique({ where: { id: userId } });
      if (!user || user.role !== "member") return null;
      if (user.status !== "pending_approval") return { user, member: null, approved: false };
      const approvedAt = new Date();
      const approvedUser = await transaction.users.update({ where: { id: userId }, data: { status: "active" } });
      const member = await transaction.members.update({
        where: { user_id: userId },
        data: { approved_by: approvedBy, approved_at: approvedAt },
      });
      await transaction.audit_logs.create({ data: { actor_user_id: approvedBy, action: "member.registration.approved", entity_type: "member", entity_id: member.id, summary: "Lễ tân đã duyệt tài khoản hội viên.", new_value: { userStatus: "active" } } });
      return { user: approvedUser, member, approved: true };
    });
  },
};
