import { randomBytes } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import { hashPassword } from "../../shared/auth/password.js";
import { violatesUniqueConstraint, retryOnUniqueConstraint } from "../../shared/database/unique-constraint.js";
import { staffCredentialsDeliveryService } from "../staff/staff-credentials-delivery.service.js";

const viewContact = (contact) => ({ id: contact.id, fullName: contact.full_name, relationship: contact.relationship, phone: contact.phone, isPrimary: contact.is_primary });
const persistContact = (contact) => ({ full_name: contact.fullName, relationship: contact.relationship, phone: contact.phone, is_primary: contact.isPrimary });
const view = ({ member, contacts, overview }) => ({
  id: member.id, memberCode: member.member_code, fullName: member.full_name, email: member.email, phone: member.phone,
  dateOfBirth: member.date_of_birth, gender: member.gender, joinedAt: member.joined_at, contacts: (contacts ?? []).map(viewContact),
  coachName: overview?.coachName ?? null, registeredPackageName: overview?.membership?.package_name_snapshot ?? null,
  membershipStatus: overview?.membership?.status ?? null, membershipExpiresOn: overview?.membership?.expires_on ?? null,
});

function memberConflict(error) {
  if (!violatesUniqueConstraint(error)) return null;
  if (violatesUniqueConstraint(error, ["email"])) return new AppError({ statusCode: 409, code: "MEMBER_EMAIL_EXISTS", message: "Email này đã được sử dụng bởi một hội viên khác.", details: { field: "email" } });
  if (violatesUniqueConstraint(error, ["phone"])) return new AppError({ statusCode: 409, code: "MEMBER_PHONE_EXISTS", message: "Số điện thoại này đã được sử dụng bởi một hội viên khác.", details: { field: "phone" } });
  if (violatesUniqueConstraint(error, ["member_code"])) return new AppError({ statusCode: 409, code: "MEMBER_CODE_CONFLICT", message: "Không thể cấp mã hội viên. Vui lòng thử lại.", details: { field: "memberCode" } });
  return new AppError({ statusCode: 409, code: "MEMBER_RECORD_EXISTS", message: "Thông tin hội viên đã tồn tại. Vui lòng kiểm tra lại và thử với dữ liệu khác." });
}

export function createMemberService({ repository, auditService, credentialsDelivery = staffCredentialsDeliveryService }) {
  return {
    async list() {
      return Promise.all((await repository.listWithOverview()).map(async ({ member, overview }) => view({ member, overview, contacts: await repository.contacts(member.id) })));
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
