import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Sports Center API listening on http://localhost:${env.port}${env.apiBasePath}`);
});

function shutdown(signal) {
  console.log(`${signal} received. Closing HTTP server.`);
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
