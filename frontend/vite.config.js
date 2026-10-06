import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api/v1": {
        target: "http://localhost:8880",
        changeOrigin: true,
        headers: {
          origin: "http://localhost:5173",
        },
      },
    },
  },
  test: {
    ...(process.platform === "win32" ? { pool: "threads", maxWorkers: 4 } : {}),
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    include: ["src/**/*.test.{js,jsx}", "server/**/*.test.js"],
  },
});
