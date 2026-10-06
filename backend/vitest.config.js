import { defineConfig } from "vitest/config";
export default defineConfig({ test: {
  setupFiles: ["./test/setup-notifications.js"],
  // Windows fork workers can terminate in native startup; threads avoid that path.
  ...(process.platform === "win32" ? { pool: "threads", maxWorkers: 4 } : {}),
} });
