import { prisma } from "../../database.js";

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
        data: { display_name: input.fullName, avatar_url: input.avatarUrl ?? null },
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
              data: input.contacts.map((contact) => ({ ...contact, member_id: member.id })),
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
    return prisma.account_verifications.update({ where: { id }, data: { attempts: { increment: 1 } } });
  },

  markVerificationVerified(id) {
    return prisma.account_verifications.update({ where: { id }, data: { verified_at: new Date() } });
  },

  expireActiveVerifications({ userId, purpose }) {
    return prisma.account_verifications.updateMany({
      where: { user_id: userId, purpose, verified_at: null, expires_at: { gt: new Date() } },
      data: { expires_at: new Date() },
    });
  },

  markVerificationVerifiedOnce(id) {
    return prisma.account_verifications.updateMany({ where: { id, verified_at: null }, data: { verified_at: new Date() } });
  },

  async areRegistrationChannelsVerified(userId) {
    const channels = await Promise.all(["email", "phone"].map((channel) => prisma.account_verifications.findFirst({
      where: { channel, purpose: "registration", user_id: userId },
      orderBy: { created_at: "desc" },
    })));
    return channels.every((verification) => verification?.verified_at);
  },

  updateUserStatus(userId, status) {
    return prisma.users.update({ where: { id: userId }, data: { status } });
  },

  createSession({ expiresAt, userId }) {
    return prisma.auth_sessions.create({ data: { expires_at: expiresAt, user_id: userId } });
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
      const consumed = await transaction.auth_mfa_enrollments.updateMany({ where: { id: enrollmentId, user_id: userId, consumed_at: null }, data: { consumed_at: new Date() } });
      if (consumed.count !== 1) return null;
      return transaction.auth_totp_factors.upsert({ where: { user_id: userId }, create: { user_id: userId, secret_ciphertext: secretCiphertext }, update: { secret_ciphertext: secretCiphertext } });
    });
  },

  createMfaLoginChallenge({ userId, expiresAt }) {
    return prisma.auth_mfa_login_challenges.create({ data: { user_id: userId, expires_at: expiresAt } });
  },

  async findMfaLoginChallenge(challengeId) {
    return prisma.auth_mfa_login_challenges.findFirst({ where: { id: challengeId, used_at: null } });
  },

  async consumeMfaLoginChallenge(challengeId) {
    const challenge = await this.findMfaLoginChallenge(challengeId);
    if (!challenge || challenge.expires_at <= new Date()) return null;
    const consumed = await prisma.auth_mfa_login_challenges.updateMany({ where: { id: challengeId, user_id: challenge.user_id, used_at: null }, data: { used_at: new Date() } });
    return consumed.count === 1 ? challenge : null;
  },

  revokeSession(sessionId) {
    return prisma.auth_sessions.updateMany({ where: { id: sessionId, revoked_at: null }, data: { revoked_at: new Date() } });
  },

  userCredentials(userId) { return prisma.users.findUnique({ where: { id: userId }, select: { id: true, password_hash: true } }); },
  updatePassword(userId, passwordHash) { return prisma.users.update({ where: { id: userId }, data: { password_hash: passwordHash } }); },
  revokeUserSessions(userId) { return prisma.auth_sessions.updateMany({ where: { user_id: userId, revoked_at: null }, data: { revoked_at: new Date() } }); },

  async findSessionUser(sessionId, userId) {
    const session = await prisma.auth_sessions.findUnique({ where: { id: sessionId } });
    if (!session || session.user_id !== userId || session.revoked_at || session.expires_at <= new Date()) return null;
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) return null;
    await prisma.auth_sessions.update({ where: { id: sessionId }, data: { last_seen_at: new Date() } });
    return { session, user };
  },

  getPermissions(role) {
    return prisma.role_permissions.findMany({
      where: { role_code: role },
      select: { permission_code: true },
    });
  },

  async listPendingRegistrations() {
    const users = await prisma.users.findMany({
      where: { role: "member", status: "pending_approval" },
      orderBy: { created_at: "asc" },
    });
    const members = users.length ? await prisma.members.findMany({ where: { user_id: { in: users.map((user) => user.id) } } }) : [];
    const memberByUserId = new Map(members.map((member) => [member.user_id, member]));
    return users.map((user) => ({ user, member: memberByUserId.get(user.id) ?? null }));
  },

  async approveRegistration({ approvedBy, userId }) {
    return prisma.$transaction(async (transaction) => {
      const user = await transaction.users.findUnique({ where: { id: userId } });
      if (!user || user.role !== "member") return null;
      if (user.status !== "pending_approval") return { user, member: null, approved: false };
      const approvedAt = new Date();
      const approvedUser = await transaction.users.update({ where: { id: userId }, data: { status: "active" } });
      const member = await transaction.members.update({
        where: { user_id: userId },
        data: { approved_by: approvedBy, approved_at: approvedAt },
      });
      return { user: approvedUser, member, approved: true };
    });
  },
};
