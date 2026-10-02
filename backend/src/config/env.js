import "dotenv/config";
import { z } from "zod";
import { defaultPublicWebOrigin, emailWebLink } from "../shared/email/web-link.js";

export function parseEnvBoolean(value) {
  if (typeof value !== "string") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return value;
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8880),
  API_BASE_PATH: z.string().startsWith("/").default("/api/v1"),
  PUBLIC_API_ORIGIN: z.string().url().optional(),
  PUBLIC_WEB_ORIGIN: z.string().url().refine((publicWebOrigin) => {
    try { emailWebLink("/", { publicWebOrigin }); return true; } catch { return false; }
  }, "Must be a public HTTPS origin without credentials or a path.").default(defaultPublicWebOrigin),
  RENDER_EXTERNAL_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  AUTH_JWT_SECRET: z.string().min(32).default("development-only-auth-secret-change-before-production"),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(8),
  AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOGIN_WINDOW_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
  AUTH_MFA_ENCRYPTION_KEY: z.string().min(32).default("development-only-mfa-encryption-key-change-before-production"),
  AUTH_MFA_ENROLLMENT_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  AUTH_MFA_CHALLENGE_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(5),
  CAPTCHA_ENABLED: z.preprocess(parseEnvBoolean, z.boolean()).default(false),
  RECAPTCHA_SECRET_KEY: z.string().min(1).optional(),
  VERIFICATION_CODE_SECRET: z.string().min(32).default("development-only-verification-secret-change-before-production"),
  VERIFICATION_CODE_TTL_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  VERIFICATION_DELIVERY_MODE: z.enum(["development", "provider"]).default("development"),
  RESEND_API_KEY: z.string().startsWith("re_").optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().trim().min(1).max(100).default("Kinetic Sports"),
  JOBS_ENABLED: z.preprocess(parseEnvBoolean, z.boolean()).default(true),
  JOB_INTERVAL_MINUTES: z.coerce.number().int().min(15).max(1440).default(60),
  PAYOS_CLIENT_ID: z.string().min(1).optional(),
  PAYOS_API_KEY: z.string().min(1).optional(),
  PAYOS_CHECKSUM_KEY: z.string().min(1).optional(),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);
if (!parsedEnvironment.success) {
  throw new Error(`Invalid server environment: ${parsedEnvironment.error.message}`);
}

const values = parsedEnvironment.data;

if (values.NODE_ENV === "production" && (
  values.AUTH_JWT_SECRET === "development-only-auth-secret-change-before-production"
  || values.VERIFICATION_CODE_SECRET === "development-only-verification-secret-change-before-production"
  || values.AUTH_MFA_ENCRYPTION_KEY === "development-only-mfa-encryption-key-change-before-production"
)) {
  throw new Error("Authentication secrets must be configured in production.");
}

if (values.NODE_ENV === "production" && values.VERIFICATION_DELIVERY_MODE === "provider" && (!values.RESEND_API_KEY || !values.RESEND_FROM_EMAIL)) {
  throw new Error("Resend must be configured when production email delivery is enabled.");
}

if (values.NODE_ENV === "production" && values.CAPTCHA_ENABLED && !values.RECAPTCHA_SECRET_KEY) {
  throw new Error("RECAPTCHA_SECRET_KEY must be configured when CAPTCHA is enabled in production.");
}

export const env = Object.freeze({
  nodeEnv: values.NODE_ENV,
  port: values.PORT,
  apiBasePath: values.API_BASE_PATH,
  publicApiOrigin: (values.PUBLIC_API_ORIGIN ?? values.RENDER_EXTERNAL_URL ?? "").replace(/\/$/, ""),
  publicWebOrigin: values.PUBLIC_WEB_ORIGIN.replace(/\/$/, ""),
  corsOrigins: values.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
  authJwtSecret: values.AUTH_JWT_SECRET,
  authSessionTtlHours: values.AUTH_SESSION_TTL_HOURS,
  authLoginMaxAttempts: values.AUTH_LOGIN_MAX_ATTEMPTS,
  authLoginWindowMinutes: values.AUTH_LOGIN_WINDOW_MINUTES,
  authMfaEncryptionKey: values.AUTH_MFA_ENCRYPTION_KEY,
  authMfaEnrollmentTtlMinutes: values.AUTH_MFA_ENROLLMENT_TTL_MINUTES,
  authMfaChallengeTtlMinutes: values.AUTH_MFA_CHALLENGE_TTL_MINUTES,
  captchaEnabled: values.CAPTCHA_ENABLED,
  recaptchaSecretKey: values.RECAPTCHA_SECRET_KEY,
  verificationCodeSecret: values.VERIFICATION_CODE_SECRET,
  verificationCodeTtlMinutes: values.VERIFICATION_CODE_TTL_MINUTES,
  verificationDeliveryMode: values.VERIFICATION_DELIVERY_MODE,
  resendApiKey: values.RESEND_API_KEY,
  resendFromEmail: values.RESEND_FROM_EMAIL,
  resendFromName: values.RESEND_FROM_NAME,
  jobsEnabled: values.JOBS_ENABLED,
  jobIntervalMinutes: values.JOB_INTERVAL_MINUTES,
  payosClientId: values.PAYOS_CLIENT_ID,
  payosApiKey: values.PAYOS_API_KEY,
  payosChecksumKey: values.PAYOS_CHECKSUM_KEY,
});
