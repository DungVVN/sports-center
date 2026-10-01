import { randomBytes } from "node:crypto";
import { AppError } from "../../../shared/errors/app-error.js";
import { hashPassword } from "../../../shared/auth/password.js";
import { violatesUniqueConstraint, retryOnUniqueConstraint } from "../../../shared/database/unique-constraint.js";

const viewContact = (contact) => ({ id: contact.id, fullName: contact.full_name, relationship: contact.relationship, phone: contact.phone, isPrimary: contact.is_primary });
const persistContact = (contact) => ({ full_name: contact.fullName, relationship: contact.relationship, phone: contact.phone, is_primary: contact.isPrimary });
const view = ({ member, contacts, overview }) => ({
  id: member.id, memberCode: member.member_code, fullName: member.full_name, email: member.email, phone: member.phone,
  dateOfBirth: member.date_of_birth, gender: member.gender, joinedAt: member.joined_at, contacts: (contacts ?? []).map(viewContact),
  coachName: overview?.coachName ?? null, registeredPackageName: overview?.membership?.package_name_snapshot ?? null,
  membershipStatus: overview?.membership?.status ?? null, membershipExpiresOn: overview?.membership?.expires_on ?? null,
  hasAccount: Boolean(member.user_id),
});

function memberConflict(error) {
  if (!violatesUniqueConstraint(error)) return null;
  if (violatesUniqueConstraint(error, ["email"])) return new AppError({ statusCode: 409, code: "MEMBER_EMAIL_EXISTS", message: "Email này đã được sử dụng bởi một hội viên khác.", details: { field: "email" } });
  if (violatesUniqueConstraint(error, ["phone"])) return new AppError({ statusCode: 409, code: "MEMBER_PHONE_EXISTS", message: "Số điện thoại này đã được sử dụng bởi một hội viên khác.", details: { field: "phone" } });
  if (violatesUniqueConstraint(error, ["member_code"])) return new AppError({ statusCode: 409, code: "MEMBER_CODE_CONFLICT", message: "Không thể cấp mã hội viên. Vui lòng thử lại.", details: { field: "memberCode" } });
  return new AppError({ statusCode: 409, code: "MEMBER_RECORD_EXISTS", message: "Thông tin hội viên đã tồn tại. Vui lòng kiểm tra lại và thử với dữ liệu khác." });
}

export function createMemberService({ repository, auditService, credentialsDelivery }) {
  return {
    async list() {
      const items = await repository.listWithOverview();
      if (!items.length) return [];
      const contacts = await repository.contactsForMembers(items.map(({ member }) => member.id));
      const contactsByMember = new Map();
      for (const contact of contacts) {
        const memberContacts = contactsByMember.get(contact.member_id) ?? [];
        memberContacts.push(contact);
        contactsByMember.set(contact.member_id, memberContacts);
      }
      return items.map(({ member, overview }) => view({ member, overview, contacts: contactsByMember.get(member.id) }));
    },
    async get(id) {
      const item = await repository.findWithContacts(id);
      if (!item) throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." });
      return view(item);
    },
    async getByUserId(userId) {
      const member = await repository.findByUserId(userId);
      if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_PROFILE_NOT_FOUND", message: "Tài khoản chưa có hồ sơ hội viên." });
      return this.get(member.id);
    },
    async create(input, actorUserId) {
      const createAccount = input.createAccount === true;
      const email = input.email?.trim().toLowerCase() || null;
      const temporaryPassword = createAccount ? randomBytes(12).toString("base64url") : null;
      const passwordHash = createAccount ? await hashPassword(temporaryPassword) : null;
      try {
        const created = await retryOnUniqueConstraint(() => repository.create({
          member_code: `MBR-${randomBytes(5).toString("hex").toUpperCase()}`,
          full_name: input.fullName, email, phone: input.phone,
          date_of_birth: input.dateOfBirth ? new Date(input.dateOfBirth) : null, gender: input.gender ?? null,
          created_by: actorUserId, contacts: (input.contacts ?? []).map(persistContact),
          ...(createAccount ? { account: { email, fullName: input.fullName, passwordHash } } : {}),
        }), { fields: ["member_code"] });
        const credentialEmail = createAccount ? await credentialsDelivery.deliver({
          recipient: email,
          fullName: input.fullName,
          temporaryPassword,
          accountLabel: "hội viên",
        }) : { delivered: false };
        await auditService.record({
          actorUserId,
          action: "member.created",
          entityType: "member",
          entityId: created.member.id,
          summary: createAccount ? "Đã tạo tài khoản hội viên." : "Đã tạo hồ sơ hội viên.",
          newValue: { accountCreated: createAccount, credentialEmailDelivered: credentialEmail.delivered },
        });
        return {
          ...view(created),
          accountCreated: createAccount,
          credentialEmailDelivered: credentialEmail.delivered,
          ...(createAccount && !credentialEmail.delivered ? { temporaryPassword } : {}),
        };
      } catch (error) {
        throw memberConflict(error) ?? error;
      }
    },
    async issueAccountCredentials(id, actorUserId) {
      const member = await repository.find(id);
      if (!member) throw new AppError({ statusCode: 404, code: "MEMBER_NOT_FOUND", message: "Không tìm thấy hội viên." });
      if (!member.email) throw new AppError({ statusCode: 422, code: "MEMBER_EMAIL_REQUIRED", message: "Hội viên cần có email trước khi tạo hoặc gửi lại tài khoản." });

      const temporaryPassword = randomBytes(12).toString("base64url");
      try {
        const issued = await repository.issueAccountCredentials(id, await hashPassword(temporaryPassword));
        const credentialEmail = await credentialsDelivery.deliver({
          recipient: issued.user.email,
          fullName: issued.user.display_name,
          temporaryPassword,
          accountLabel: "hội viên",
        });
        await auditService.record({
          actorUserId,
          action: issued.accountCreated ? "member.account.created" : "member.credentials.reissued",
          entityType: "member",
          entityId: id,
          summary: issued.accountCreated ? "Đã tạo tài khoản hội viên và gửi mật khẩu tạm." : "Đã gửi lại mật khẩu tạm cho hội viên.",
          newValue: { accountCreated: issued.accountCreated, credentialEmailDelivered: credentialEmail.delivered },
        });
        return {
          member: view({ member: issued.member, contacts: [] }),
          accountCreated: issued.accountCreated,
          credentialEmailDelivered: credentialEmail.delivered,
          ...(credentialEmail.delivered ? {} : { temporaryPassword }),
        };
      } catch (error) {
        throw memberConflict(error) ?? error;
      }
    },
    async update(id, input, actorUserId) {
      await this.get(id);
      try {
        const updated = await repository.update(id, {
          ...(input.fullName ? { full_name: input.fullName } : {}), ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.phone ? { phone: input.phone } : {}), ...(input.dateOfBirth !== undefined ? { date_of_birth: input.dateOfBirth ? new Date(input.dateOfBirth) : null } : {}),
          ...(input.gender !== undefined ? { gender: input.gender } : {}),
        });
        await auditService.record({ actorUserId, action: "member.updated", entityType: "member", entityId: id, summary: "Đã cập nhật hồ sơ hội viên." });
        return view(updated);
      } catch (error) {
        throw memberConflict(error) ?? error;
      }
    },
    async replaceContacts(id, contacts, actorUserId) {
      await this.get(id);
      if (contacts.filter((item) => item.isPrimary).length > 1) throw new AppError({ statusCode: 422, code: "MULTIPLE_PRIMARY_CONTACTS", message: "Chỉ được có một liên hệ khẩn cấp chính." });
      const updated = await repository.replaceContacts(id, contacts.map(persistContact));
      await auditService.record({ actorUserId, action: "member.emergency_contacts.updated", entityType: "member", entityId: id, summary: "Đã cập nhật liên hệ khẩn cấp." });
      return updated.map(viewContact);
    },
  };
}
