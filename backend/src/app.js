import { operationNotificationMiddleware } from "./shared/middleware/operation-notification.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { createServices } from "./app/create-services.js";
import { registerRoutes } from "./app/register-routes.js";
import { env } from "./config/env.js";
import { openApiSpec } from "./openapi/spec.js";
import { sendSuccess } from "./shared/http/response.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { notFound } from "./shared/middleware/not-found.js";
import { requestId } from "./shared/middleware/request-id.js";
import { requireTrustedOrigin } from "./shared/security/trusted-origin.middleware.js";

function isAllowedOrigin(origin) {
  return !origin || env.corsOrigins.includes(origin);
}

export function createApp(overrides = {}) {
  const services = createServices(overrides);
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
  app.use(express.json({ limit: "1mb", verify: (request, response, buffer) => { request.rawBody = buffer; } }));
  app.use(requestId);
  app.use(requireTrustedOrigin);

  app.get(`${env.apiBasePath}/health`, (request, response) => sendSuccess(response, {
    data: { status: "ok", requestId: request.id },
  }));
  app.get("/openapi.json", (request, response) => response.json(openApiSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));
  app.use(operationNotificationMiddleware(services.operationNotificationService, env.apiBasePath));
  registerRoutes(app, env.apiBasePath, services);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
