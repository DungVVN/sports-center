export const uuid = { type: "string", format: "uuid" };
export const jsonBody = (schema) => ({ required: true, content: { "application/json": { schema } } });
export const publicPackageResponse = {
  type: "object",
  required: ["success", "data"],
  properties: {
    success: { type: "boolean", const: true },
    data: {
      type: "array",
      items: {
        type: "object",
        required: ["code", "name", "priceVnd", "durationDays", "benefits"],
        properties: {
          code: { type: "string", enum: ["BASIC", "STANDARD", "PREMIUM"] },
          name: { type: "string" },
          priceVnd: { type: "string", pattern: "^[0-9]+$", example: "490000" },
          durationDays: { type: "integer", minimum: 1 },
          benefits: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};
