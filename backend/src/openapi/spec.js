import { env } from "../config/env.js";

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Sports Center API",
    version: "0.1.0",
    description: "API contract for the Sports Center Management System MVP.",
  },
  servers: [{ url: env.apiBasePath }],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Check API availability",
        responses: {
          200: {
            description: "API is available",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["success", "data"],
                  properties: {
                    success: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      required: ["status"],
                      properties: { status: { type: "string", example: "ok" } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
