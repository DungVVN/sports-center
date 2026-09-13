import { prisma } from "../../database.js";

export const authRepository = {
  findUserByEmail(email) {
    return prisma.users.findUnique({ where: { email } });
  },

  findUserById(id) {
    return prisma.users.findUnique({ where: { id } });
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

  createVerification({ channel, codeHash, expiresAt, userId }) {
    return prisma.account_verifications.create({
      data: { channel, code_hash: codeHash, expires_at: expiresAt, user_id: userId },
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

  revokeSession(sessionId) {
    return prisma.auth_sessions.updateMany({ where: { id: sessionId, revoked_at: null }, data: { revoked_at: new Date() } });
  },

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
