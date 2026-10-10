import { uuid } from "./contract-helpers.js";

export const coreSchemas = {
  RegisterRequest: {
    type: "object",
    required: ["fullName", "email", "phone", "password"],
    properties: {
      fullName: { type: "string", example: "Nguyễn Minh Anh" },
      email: { type: "string", format: "email" },
      phone: { type: "string", example: "0901234567" },
      password: { type: "string", format: "password", minLength: 8, maxLength: 72, description: "Tối đa 72 byte UTF-8; ký tự có dấu/emoji có thể chiếm nhiều byte." },
      captchaToken: { type: "string", description: "Bắt buộc khi CAPTCHA_ENABLED=true" },
    },
  },
  VerificationRecipient: {
    type: "object",
    required: ["userId", "channel"],
    properties: { userId: { type: "string", format: "uuid" }, channel: { type: "string", enum: ["email"] } },
  },
  VerificationRequest: {
    allOf: [
      { $ref: "#/components/schemas/VerificationRecipient" },
      { type: "object", required: ["code"], properties: { code: { type: "string", example: "123456" } } },
    ],
  },
  LoginRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", format: "password" },
      captchaToken: { type: "string", description: "Bắt buộc khi CAPTCHA_ENABLED=true" },
    },
  },
  TotpEnrollmentConfirmRequest: {
    type: "object",
    required: ["enrollmentId", "code"],
    properties: {
      enrollmentId: { type: "string", format: "uuid" },
      code: { type: "string", pattern: "^\\d{6}$", example: "123456" },
    },
  },
  TotpLoginVerifyRequest: {
    type: "object",
    required: ["challengeId", "code"],
    properties: {
      challengeId: { type: "string", format: "uuid" },
      code: { type: "string", pattern: "^\\d{6}$", example: "123456" },
    },
  },
  UuidOrderRequest: {
    type: "object",
    required: ["ids"],
    properties: { ids: { type: "array", minItems: 1, items: uuid } },
  },
  TrainingExerciseRequest: {
    type: "object",
    required: ["name", "sets", "rest_seconds"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 100 },
      sets: { type: "integer", minimum: 1 },
      reps: { type: ["integer", "null"], minimum: 1 },
      duration_seconds: { type: ["integer", "null"], minimum: 1 },
      rest_seconds: { type: "integer", minimum: 0 },
      instructions: { type: "string", maxLength: 500 },
    },
  },
  TrainingSessionRequest: {
    type: "object",
    required: ["position", "title", "exercises"],
    properties: {
      position: { type: "integer", minimum: 1 },
      title: { type: "string", minLength: 2, maxLength: 200 },
      scheduledOn: { type: "string", format: "date" },
      exercises: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/TrainingExerciseRequest" } },
    },
  },
  AuthUser: {
    type: "object",
    required: ["id", "email", "displayName", "role", "status", "mustChangePassword", "profileSetupRequired"],
    properties: {
      id: uuid,
      email: { type: "string", format: "email" },
      displayName: { type: "string" },
      role: { type: "string", enum: ["admin", "manager", "receptionist", "coach", "member"] },
      status: { type: "string" },
      mustChangePassword: { type: "boolean" },
      profileSetupRequired: { type: "boolean" },
    },
  },
  CurrentSessionResponse: {
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean" },
      data: {
        type: "object",
        required: ["user", "permissions"],
        properties: {
          user: { $ref: "#/components/schemas/AuthUser" },
          permissions: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
  RolePermissionMatrixResponse: {
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean" },
      data: {
        type: "object",
        required: ["permissions", "roles"],
        properties: {
          permissions: {
            type: "array",
            items: {
              type: "object",
              required: ["code", "description", "group", "requires", "availableRoles"],
              properties: {
                code: { type: "string" },
                description: { type: "string" },
                group: { type: "string" },
                requires: { type: "array", items: { type: "string" } },
                availableRoles: {
                  type: "array",
                  items: { type: "string", enum: ["manager", "receptionist", "coach", "member"] },
                },
              },
            },
          },
          roles: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              required: ["code", "label", "version", "permissionCodes"],
              properties: {
                code: { type: "string", enum: ["manager", "receptionist", "coach", "member"] },
                label: { type: "string" },
                version: { type: "integer", minimum: 0 },
                permissionCodes: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
  },
  RolePermissionUpdateResponse: {
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean" },
      data: {
        type: "object",
        required: ["kind", "role", "version", "permissionCodes"],
        properties: {
          kind: { type: "string", enum: ["updated"] },
          role: { type: "string", enum: ["manager", "receptionist", "coach", "member"] },
          version: { type: "integer", minimum: 1 },
          permissionCodes: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};
