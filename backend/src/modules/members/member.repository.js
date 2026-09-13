import { prisma } from "../../database.js";

export const memberRepository = {
  list() { return prisma.members.findMany({ orderBy: { created_at: "desc" } }); },
  find(id) { return prisma.members.findUnique({ where: { id } }); },
  contacts(memberId) { return prisma.member_emergency_contacts.findMany({ where: { member_id: memberId }, orderBy: { is_primary: "desc" } }); },
  async findWithContacts(id) { const member = await this.find(id); return member ? { member, contacts: await this.contacts(id) } : null; },
  create(data) { return prisma.$transaction(async (tx) => { const { contacts = [], ...memberData } = data; const member = await tx.members.create({ data: memberData }); const createdContacts = contacts.length ? await Promise.all(contacts.map((contact) => tx.member_emergency_contacts.create({ data: { ...contact, member_id: member.id } }))) : []; return { member, contacts: createdContacts }; }); },
  async update(id, data) { await prisma.members.update({ where: { id }, data }); return this.findWithContacts(id); },
  async replaceContacts(memberId, contacts) { await prisma.$transaction(async (tx) => { await tx.member_emergency_contacts.deleteMany({ where: { member_id: memberId } }); await Promise.all(contacts.map((contact) => tx.member_emergency_contacts.create({ data: { ...contact, member_id: memberId } }))); }); return this.contacts(memberId); },
};
