import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";
import { loadEnv } from "vite";

const configDir = dirname(fileURLToPath(import.meta.url));
const env = loadEnv(process.env.NODE_ENV ?? "test", configDir, "");
const baseURL = process.env.E2E_BASE_URL ?? env.E2E_BASE_URL;

if (!baseURL) {
  throw new Error("E2E_BASE_URL là bắt buộc. Ví dụ: https://sports-center-xi.vercel.app");
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  // Render may need several seconds to wake before the authenticated workspace
  // is rendered. Keep assertions production-safe without extending a test past
  // its overall timeout.
  expect: { timeout: 30_000 },
  fullyParallel: false,
  // Production tests share the approved role accounts, so parallel workers can
  // revoke or replace each other's session while asserting a login.
  workers: process.env.E2E_FULL_PRODUCTION === "1" ? 1 : undefined,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
