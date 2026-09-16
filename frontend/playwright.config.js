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
  fullyParallel: false,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
