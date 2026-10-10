import { uuid, jsonBody } from "./contract-helpers.js";

export function applyRequestContract(openApiSpec) {
  // Keep request bodies and path parameters explicit for Swagger UI's Try it out.
  const staffFields = {
    fullName: { type: "string", minLength: 2, maxLength: 120 },
    email: { type: "string", format: "email" },
    phone: { type: "string", minLength: 9, maxLength: 20 },
    dateOfBirth: { type: ["string", "null"], format: "date" },
    notes: { type: ["string", "null"], maxLength: 1000 },
    role: { type: "string", enum: ["manager", "receptionist", "coach"] },
    specialties: { type: "array", maxItems: 12, items: { type: "string", minLength: 1, maxLength: 60 } },
  };
  const memberFields = {
    fullName: { type: "string", minLength: 2, maxLength: 120 },
    email: { type: ["string", "null"], format: "email" },
    phone: { type: "string", minLength: 9, maxLength: 20 },
    dateOfBirth: { type: ["string", "null"], format: "date" },
    gender: { type: ["string", "null"], maxLength: 30 },
  };
  const contact = {
    type: "object",
    required: ["fullName", "relationship", "phone"],
    properties: {
      fullName: { type: "string", minLength: 2, maxLength: 120 },
      relationship: { type: "string", minLength: 2, maxLength: 60 },
      phone: { type: "string", minLength: 9, maxLength: 20 },
      isPrimary: { type: "boolean", default: false },
    },
  };
  const classFields = {
    name: { type: "string", minLength: 2, maxLength: 120 },
    type: { type: "string", minLength: 2, maxLength: 60 },
    description: { type: "string", maxLength: 1000 },
    coachUserId: uuid,
    roomId: uuid,
    startsAt: { type: "string", format: "date-time" },
    endsAt: { type: "string", format: "date-time" },
    capacity: { type: "integer", minimum: 1, maximum: 500 },
  };
  const entitlement = {
    type: "object",
    required: ["code"],
    properties: {
      code: {
        type: "string",
        enum: [
          "gym_access",
          "group_class_booking",
          "pool_access",
          "sauna_access",
          "towel_service",
          "premium_locker",
          "pt_session",
        ],
      },
      usageLimit: { type: ["integer", "null"], minimum: 1 },
      limitPeriod: { type: ["string", "null"], enum: ["weekly", "monthly", null] },
    },
  };
  const packageFields = {
    code: { type: "string", minLength: 2, maxLength: 30, pattern: "^[A-Z0-9_-]+$" },
    name: { type: "string", minLength: 2, maxLength: 100 },
    priceVnd: { type: "integer", minimum: 0 },
    durationDays: { type: "integer", minimum: 1, maximum: 730 },
    tierRank: { type: "integer", minimum: 1 },
    benefits: { type: "array", maxItems: 20, items: { type: "string", minLength: 1, maxLength: 200 } },
    entitlements: { type: "array", maxItems: 20, items: entitlement },
    isActive: { type: "boolean" },
  };
  const exercise = { $ref: "#/components/schemas/TrainingExerciseRequest" };
  const bodyContracts = [
    [
      "/training-templates",
      "post",
      {
        type: "object",
        required: ["name", "targetGroup", "exercises"],
        properties: {
          name: { type: "string", minLength: 2 },
          targetGroup: { type: "string", minLength: 2 },
          description: { type: "string", maxLength: 500 },
          exercises: { type: "array", minItems: 1, items: exercise },
        },
      },
    ],
    [
      "/training-plans",
      "post",
      {
        type: "object",
        required: ["memberId", "name", "goal", "startsOn", "endsOn"],
        properties: {
          memberId: uuid,
          templateId: uuid,
          name: { type: "string", minLength: 2 },
          goal: { type: "string", minLength: 2 },
          startsOn: { type: "string", format: "date" },
          endsOn: { type: "string", format: "date" },
          exercises: { type: "array", items: exercise },
        },
      },
    ],
    [
      "/training-plans/{id}",
      "patch",
      {
        type: "object",
        properties: {
          name: { type: "string", minLength: 2 },
          goal: { type: "string", minLength: 2 },
          status: { type: "string", minLength: 2 },
          exercises: { type: "array", items: exercise },
        },
      },
    ],
    [
      "/training-results",
      "post",
      {
        type: "object",
        required: ["planId", "recordedOn", "metric"],
        properties: {
          planId: uuid,
          exerciseId: uuid,
          recordedOn: { type: "string", format: "date" },
          metric: { type: "string", minLength: 1 },
          valueNumeric: { type: "number" },
          valueText: { type: "string", maxLength: 500 },
          coachComment: { type: "string", maxLength: 500 },
        },
      },
    ],
    [
      "/payments",
      "post",
      {
        type: "object",
        required: ["memberId", "amountVnd"],
        additionalProperties: false,
        properties: {
          memberId: uuid,
          membershipId: uuid,
          amountVnd: { type: "integer", minimum: 1 },
          method: { type: "string", enum: ["cash", "bank_transfer", "online"] },
          provider: {
            type: "string",
            enum: ["payos"],
            description: "Bắt buộc khi method=online; không được truyền với các phương thức khác.",
          },
          notes: { type: "string", maxLength: 500 },
        },
      },
    ],
    [
      "/payments/{id}/confirm",
      "post",
      {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["paid", "failed"] },
          reconciliationNote: {
            type: "string",
            minLength: 10,
            maxLength: 500,
            description: "Bắt buộc khi xác nhận chuyển khoản paid.",
          },
        },
      },
    ],
    [
      "/classes/{id}/attendance/submit",
      "post",
      {
        type: "object",
        required: ["entries"],
        properties: {
          entries: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["bookingId", "status"],
              properties: { bookingId: uuid, status: { type: "string", enum: ["present", "absent", "late"] } },
            },
          },
        },
      },
    ],
    ["/attendance/check-in", "post", { type: "object", required: ["bookingId"], properties: { bookingId: uuid } }],
    [
      "/attendance/{id}/corrections",
      "post",
      {
        type: "object",
        required: ["status"],
        properties: {
          status: { type: "string", enum: ["present", "absent", "late", "not_marked"] },
          reason: { type: "string", minLength: 3, maxLength: 500, description: "Bắt buộc sau giờ học." },
        },
      },
    ],
    [
      "/classes",
      "post",
      {
        type: "object",
        required: ["name", "type", "coachUserId", "roomId", "startsAt", "endsAt", "capacity"],
        properties: classFields,
      },
    ],
    ["/classes/{id}", "patch", { type: "object", properties: classFields }],
    [
      "/classes/{id}/change-requests",
      "post",
      {
        type: "object",
        required: ["type", "reason"],
        properties: {
          type: { type: "string", enum: ["cancel", "reschedule"] },
          startsAt: { type: "string", format: "date-time", description: "Bắt buộc khi type=reschedule." },
          endsAt: { type: "string", format: "date-time", description: "Bắt buộc khi type=reschedule." },
          reason: { type: "string", minLength: 3, maxLength: 500 },
        },
      },
    ],
    [
      "/class-change-requests/{id}",
      "patch",
      { type: "object", required: ["approved"], properties: { approved: { type: "boolean" } } },
    ],
    [
      "/membership-packages",
      "post",
      { type: "object", required: ["code", "name", "priceVnd", "durationDays", "tierRank"], properties: packageFields },
    ],
    [
      "/membership-packages/{id}",
      "patch",
      {
        type: "object",
        properties: Object.fromEntries(Object.entries(packageFields).filter(([name]) => name !== "code")),
      },
    ],
    [
      "/membership-freeze-requests/{id}",
      "patch",
      { type: "object", required: ["approved"], properties: { approved: { type: "boolean" } } },
    ],
    [
      "/members/{id}/memberships",
      "post",
      {
        type: "object",
        required: ["packageId", "startsOn"],
        properties: { packageId: uuid, startsOn: { type: "string", format: "date" } },
      },
    ],
    [
      "/members",
      "post",
      {
        type: "object",
        required: ["fullName", "phone"],
        properties: {
          ...memberFields,
          createAccount: {
            type: "boolean",
            default: false,
            description: "Tạo tài khoản member và gửi mật khẩu tạm; khi true, email là bắt buộc.",
          },
          contacts: { type: "array", maxItems: 3, items: contact },
        },
      },
    ],
    ["/members/{id}", "patch", { type: "object", properties: memberFields }],
    [
      "/members/{id}/emergency-contacts",
      "put",
      {
        type: "object",
        required: ["contacts"],
        properties: { contacts: { type: "array", maxItems: 3, items: contact } },
      },
    ],
    ["/staff", "post", { type: "object", required: ["fullName", "email", "phone", "role"], properties: staffFields }],
    ["/staff/{id}", "patch", { type: "object", properties: staffFields }],
    [
      "/staff/{id}/status",
      "patch",
      { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["active", "suspended"] } } },
    ],
  ];

  for (const [path, method, schema] of bodyContracts) {
    openApiSpec.paths[path][method].requestBody = jsonBody(schema);
  }

}
