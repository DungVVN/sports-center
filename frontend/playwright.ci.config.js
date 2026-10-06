import { defineConfig } from "@playwright/test";
import config from "./playwright.config.js";

export default defineConfig({
  ...config,
  testMatch: "release-smoke.spec.js",
  workers: 1,
  use: { ...config.use, browserName: "chromium" },
  webServer: { command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
});
