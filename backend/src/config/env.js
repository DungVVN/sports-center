import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8880),
  API_BASE_PATH: z.string().startsWith("/").default("/api/v1"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  AUTH_JWT_SECRET: z.string().min(32).default("development-only-auth-secret-change-before-production"),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(8),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  VERIFICATION_CODE_SECRET: z.string().min(32).default("development-only-verification-secret-change-before-production"),
  VERIFICATION_CODE_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  VERIFICATION_DELIVERY_MODE: z.enum(["development", "provider"]).default("development"),
  JOBS_ENABLED: z.coerce.boolean().default(true),
  JOB_INTERVAL_MINUTES: z.coerce.number().int().min(15).max(1440).default(60),
  PAYMENT_WEBHOOK_SECRET: z.string().min(32).default("development-only-payment-webhook-secret"),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);
if (!parsedEnvironment.success) {
  throw new Error(`Invalid server environment: ${parsedEnvironment.error.message}`);
}

const values = parsedEnvironment.data;

if (values.NODE_ENV === "production" && (
  values.AUTH_JWT_SECRET === "development-only-auth-secret-change-before-production"
  || values.VERIFICATION_CODE_SECRET === "development-only-verification-secret-change-before-production"
)) {
  throw new Error("Authentication secrets must be configured in production.");
}

export const env = Object.freeze({
  nodeEnv: values.NODE_ENV,
  port: values.PORT,
  apiBasePath: values.API_BASE_PATH,
  corsOrigins: values.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
  authJwtSecret: values.AUTH_JWT_SECRET,
  authSessionTtlHours: values.AUTH_SESSION_TTL_HOURS,
  authLoginMaxAttempts: values.AUTH_LOGIN_MAX_ATTEMPTS,
  authLoginWindowMinutes: values.AUTH_LOGIN_WINDOW_MINUTES,
  verificationCodeSecret: values.VERIFICATION_CODE_SECRET,
  verificationCodeTtlMinutes: values.VERIFICATION_CODE_TTL_MINUTES,
  verificationDeliveryMode: values.VERIFICATION_DELIVERY_MODE,
  jobsEnabled: values.JOBS_ENABLED,
  jobIntervalMinutes: values.JOB_INTERVAL_MINUTES,
  paymentWebhookSecret: values.PAYMENT_WEBHOOK_SECRET,
});
