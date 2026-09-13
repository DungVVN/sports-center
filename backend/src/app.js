import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { authRepository } from "./modules/auth/auth.repository.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { verificationDeliveryService } from "./modules/auth/verification-delivery.service.js";
import { staffRepository } from "./modules/staff/staff.repository.js";
import { createStaffRouter } from "./modules/staff/staff.routes.js";
import { createStaffService } from "./modules/staff/staff.service.js";
import { auditService } from "./shared/audit/audit.service.js";
import { openApiSpec } from "./openapi/spec.js";
import { sendSuccess } from "./shared/http/response.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { notFound } from "./shared/middleware/not-found.js";
import { requestId } from "./shared/middleware/request-id.js";

function isAllowedOrigin(origin) {
  return !origin || env.corsOrigins.includes(origin);
}

export function createApp({ authService = createAuthService({ repository: authRepository, verificationDelivery: verificationDeliveryService, auditService }), staffService = createStaffService({ repository: staffRepository, auditService }) } = {}) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);

  app.get(`${env.apiBasePath}/health`, (request, response) => sendSuccess(response, {
    data: { status: "ok", requestId: request.id },
  }));
  app.get("/openapi.json", (request, response) => response.json(openApiSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));
  app.use(`${env.apiBasePath}/auth`, createAuthRouter(authService));
  app.use(`${env.apiBasePath}/staff`, createStaffRouter(staffService, authService));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
