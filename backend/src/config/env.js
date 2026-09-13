import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  API_BASE_PATH: z.string().startsWith("/").default("/api/v1"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);
if (!parsedEnvironment.success) {
  throw new Error(`Invalid server environment: ${parsedEnvironment.error.message}`);
}

const values = parsedEnvironment.data;

export const env = Object.freeze({
  nodeEnv: values.NODE_ENV,
  port: values.PORT,
  apiBasePath: values.API_BASE_PATH,
  corsOrigins: values.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
});
