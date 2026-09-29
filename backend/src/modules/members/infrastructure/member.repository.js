import { prisma } from "../../../database.js";

export const memberRepository = {
  list() { return prisma.members.findMany({ orderBy: { created_at: "desc" } }); },
  async listWithOverview() {
    const members = await this.list();
    if (!members.length) return [];

    const memberIds = members.map((member) => member.id);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [memberships, assignments] = await Promise.all([
      prisma.member_memberships.findMany({
        where: { member_id: { in: memberIds } },
        orderBy: { created_at: "desc" },
        select: { member_id: true, package_name_snapshot: true, status: true, expires_on: true, created_at: true },
      }),
      prisma.member_coach_assignments.findMany({
        where: {
          member_id: { in: memberIds },
          effective_from: { lte: today },
          OR: [{ effective_to: null }, { effective_to: { gte: today } }],
        },
        orderBy: { effective_from: "desc" },
        select: { member_id: true, coach_user_id: true },
      }),
    ]);
    const coachIds = [...new Set(assignments.map((assignment) => assignment.coach_user_id))];
    const coaches = coachIds.length
      ? await prisma.users.findMany({ where: { id: { in: coachIds } }, select: { id: true, display_name: true } })
      : [];
    const coachNameById = new Map(coaches.map((coach) => [coach.id, coach.display_name]));
    const coachByMemberId = new Map();
    for (const assignment of assignments) {
      if (!coachByMemberId.has(assignment.member_id)) {
        coachByMemberId.set(assignment.member_id, coachNameById.get(assignment.coach_user_id) ?? null);
      }
    }
    const membershipPriority = { active: 0, expiring_soon: 1, frozen: 2, pending_payment: 3, expired: 4, cancelled: 5 };
    const membershipByMemberId = new Map();
    for (const membership of memberships) {
      const current = membershipByMemberId.get(membership.member_id);
      if (!current || membershipPriority[membership.status] < membershipPriority[current.status]) {
        membershipByMemberId.set(membership.member_id, membership);
      }
    }
    return members.map((member) => ({
      member,
      overview: {
        coachName: coachByMemberId.get(member.id) ?? null,
        membership: membershipByMemberId.get(member.id) ?? null,
      },
    }));
  },
  find(id) { return prisma.members.findUnique({ where: { id } }); },
  findByUserId(userId) { return prisma.members.findUnique({ where: { user_id: userId } }); },
  contacts(memberId) { return prisma.member_emergency_contacts.findMany({ where: { member_id: memberId }, orderBy: { is_primary: "desc" } }); },
  async findWithContacts(id) { const member = await this.find(id); return member ? { member, contacts: await this.contacts(id) } : null; },
  create(data) { return prisma.$transaction(async (tx) => {
    const { account, contacts = [], ...memberData } = data;
    const user = account ? await tx.users.create({ data: {
      email: account.email,
      password_hash: account.passwordHash,
      display_name: account.fullName,
      role: "member",
      status: "active",
      must_change_password: true,
      profile_setup_required: true,
    } }) : null;
    const member = await tx.members.create({ data: { ...memberData, ...(user ? { user_id: user.id } : {}) } });
    const createdContacts = contacts.length ? await Promise.all(contacts.map((contact) => tx.member_emergency_contacts.create({ data: { ...contact, member_id: member.id } }))) : [];
    return { member, contacts: createdContacts, user };
  }); },
  issueAccountCredentials(memberId, passwordHash) { return prisma.$transaction(async (tx) => {
    const member = await tx.members.findUnique({ where: { id: memberId } });
    if (!member) return null;
    if (member.user_id) {
      const user = await tx.users.update({ where: { id: member.user_id }, data: { password_hash: passwordHash, must_change_password: true } });
      await tx.auth_sessions.updateMany({ where: { user_id: user.id, revoked_at: null }, data: { revoked_at: new Date() } });
      return { member, user, accountCreated: false };
    }
    const user = await tx.users.create({ data: {
      email: member.email,
      password_hash: passwordHash,
      display_name: member.full_name,
      role: "member",
      status: "active",
      must_change_password: true,
      profile_setup_required: true,
    } });
    const updatedMember = await tx.members.update({ where: { id: memberId }, data: { user_id: user.id } });
    return { member: updatedMember, user, accountCreated: true };
  }); },
  async update(id, data) { await prisma.members.update({ where: { id }, data }); return this.findWithContacts(id); },
  async replaceContacts(memberId, contacts) { await prisma.$transaction(async (tx) => { await tx.member_emergency_contacts.deleteMany({ where: { member_id: memberId } }); await Promise.all(contacts.map((contact) => tx.member_emergency_contacts.create({ data: { ...contact, member_id: memberId } }))); }); return this.contacts(memberId); },
};
