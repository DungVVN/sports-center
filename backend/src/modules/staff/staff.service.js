import { randomBytes } from "node:crypto";
import { AppError } from "../../shared/errors/app-error.js";
import { violatesUniqueConstraint, retryOnUniqueConstraint } from "../../shared/database/unique-constraint.js";
import { hashPassword } from "../../shared/auth/password.js";
import { staffCredentialsDeliveryService } from "./staff-credentials-delivery.service.js";

const roles = new Set(["manager", "receptionist", "coach"]);

const view = (staff) => ({
  id: staff.id,
  employeeCode: staff.staff_profiles?.employee_code,
  fullName: staff.display_name,
  email: staff.email,
  role: staff.role,
  status: staff.status,
  phone: staff.staff_profiles?.phone,
  dateOfBirth: staff.staff_profiles?.date_of_birth,
  notes: staff.staff_profiles?.notes,
  specialties: staff.staff_profiles?.specialties ?? [],
  lastLoginAt: staff.last_login_at,
  createdAt: staff.created_at,
});

function conflict(message, code) {
  return new AppError({ statusCode: 409, code, message });
}

function uniqueConstraintConflict(error) {
  if (!violatesUniqueConstraint(error)) return null;

  if (violatesUniqueConstraint(error, ["email"])) {
    return conflict("Email này đã được sử dụng.", "STAFF_EMAIL_EXISTS");
  }

  if (violatesUniqueConstraint(error, ["phone"])) {
    return conflict("Số điện thoại này đã được sử dụng.", "STAFF_PHONE_EXISTS");
  }

  return conflict("Thông tin nhân viên đã tồn tại.", "STAFF_RECORD_EXISTS");
}

export function createStaffService({ repository, auditService, credentialsDelivery = staffCredentialsDeliveryService }) {
  return {
    async list() {
      return (await repository.list()).map(view);
    },

    async get(id) {
      const staff = await repository.find(id);
      if (!staff) {
        throw new AppError({ statusCode: 404, code: "STAFF_NOT_FOUND", message: "Không tìm thấy nhân viên." });
      }
      return view(staff);
    },

    async create(input, actorUserId) {
      if (!roles.has(input.role)) {
        throw new AppError({ statusCode: 422, code: "INVALID_STAFF_ROLE", message: "Vai trò nhân sự không hợp lệ." });
      }

      const email = input.email.toLowerCase();
      if (await repository.findByEmail(email)) {
        throw conflict("Email này đã được sử dụng.", "STAFF_EMAIL_EXISTS");
      }

      if (input.phone && await repository.findByPhone(input.phone)) {
        throw conflict("Số điện thoại này đã được sử dụng.", "STAFF_PHONE_EXISTS");
      }

      const temporaryPassword = randomBytes(12).toString("base64url");
      let staff;

      try {
        const passwordHash = await hashPassword(temporaryPassword);
        staff = await retryOnUniqueConstraint(() => repository.create({
          ...input,
          email,
          employeeCode: `STF-${randomBytes(4).toString("hex").toUpperCase()}`,
          passwordHash,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        }), { fields: ["employee_code"] });
      } catch (error) {
        const knownConflict = uniqueConstraintConflict(error);
        if (knownConflict) throw knownConflict;
        throw error;
      }

      const credentialEmail = await credentialsDelivery.deliver({
        recipient: staff.email,
        fullName: staff.display_name,
        temporaryPassword,
      });

      await auditService.record({
        actorUserId,
        action: "staff.created",
        entityType: "staff",
        entityId: staff.id,
        summary: "Đã tạo tài khoản nhân viên.",
        newValue: { role: staff.role, credentialEmailDelivered: credentialEmail.delivered },
      });

      return {
        staff: view(staff),
        credentialEmailDelivered: credentialEmail.delivered,
        ...(credentialEmail.delivered ? {} : { temporaryPassword }),
      };
    },

    async update(id, input, actorUserId) {
      const before = await this.get(id);
      let staff;
      try {
        staff = await repository.update(id, {
          ...input,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        });
      } catch (error) {
        throw uniqueConstraintConflict(error) ?? error;
      }
      await auditService.record({
        actorUserId,
        action: "staff.updated",
        entityType: "staff",
        entityId: id,
        summary: "Đã cập nhật nhân viên.",
        previousValue: { role: before.role },
        newValue: { role: staff.role },
      });
      return view(staff);
    },

    async setStatus(id, status, actorUserId) {
      if (!["active", "suspended"].includes(status)) {
        throw new AppError({ statusCode: 422, code: "INVALID_STAFF_STATUS", message: "Trạng thái không hợp lệ." });
      }
      const before = await this.get(id);
      const staff = await repository.setStatus(id, status);
      await auditService.record({
        actorUserId,
        action: `staff.${status}`,
        entityType: "staff",
        entityId: id,
        summary: status === "suspended" ? "Đã đình chỉ nhân viên." : "Đã kích hoạt lại nhân viên.",
        previousValue: { status: before.status },
        newValue: { status },
      });
      return view({ ...before, ...staff });
    },
    async resetPassword(id, actorUserId) {
      const before = await this.get(id);
      const temporaryPassword = randomBytes(12).toString("base64url");
      await repository.resetPassword(id, await hashPassword(temporaryPassword));
      const credentialEmail = await credentialsDelivery.deliver({ recipient: before.email, fullName: before.fullName, temporaryPassword });
      await auditService.record({ actorUserId, action: "staff.credentials.reissued", entityType: "staff", entityId: id, summary: "Admin đã cấp lại mật khẩu tạm cho nhân viên.", newValue: { credentialEmailDelivered: credentialEmail.delivered } });
      return { staff: before, credentialEmailDelivered: credentialEmail.delivered, ...(credentialEmail.delivered ? {} : { temporaryPassword }) };
    },
  };
}
