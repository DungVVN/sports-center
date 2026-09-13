import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import { openApiSpec } from "./openapi/spec.js";
import { sendSuccess } from "./shared/http/response.js";
import { errorHandler } from "./shared/middleware/error-handler.js";
import { notFound } from "./shared/middleware/not-found.js";
import { requestId } from "./shared/middleware/request-id.js";

function isAllowedOrigin(origin) {
  return !origin || env.corsOrigins.includes(origin);
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
  }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);

  app.get(`${env.apiBasePath}/health`, (request, response) => sendSuccess(response, {
    data: { status: "ok", requestId: request.id },
  }));
  app.get("/openapi.json", (request, response) => response.json(openApiSpec));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, { explorer: true }));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
