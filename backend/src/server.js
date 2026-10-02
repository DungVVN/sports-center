import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { runMembershipLifecycleJob } from "./jobs/membership-lifecycle.job.js";
import { runNotificationEmailDeliveryJob } from "./jobs/notification-email-delivery.job.js";
import { runServiceLifecycleJob } from "./jobs/service-lifecycle.job.js";

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Sports Center API listening on http://localhost:${env.port}${env.apiBasePath}`);
});

if (env.jobsEnabled) {
  void runServiceLifecycleJob().catch((error) => console.error("Service lifecycle job failed", error));
  setInterval(() => void runServiceLifecycleJob().catch((error) => console.error("Service lifecycle job failed", error)), 60_000).unref();
  void runMembershipLifecycleJob().catch((error) => console.error("Membership lifecycle job failed", error));
  void runNotificationEmailDeliveryJob().catch((error) => console.error("Notification email delivery job failed", error));
  setInterval(() => void runMembershipLifecycleJob().catch((error) => console.error("Membership lifecycle job failed", error)), env.jobIntervalMinutes * 60_000).unref();
  setInterval(() => void runNotificationEmailDeliveryJob().catch((error) => console.error("Notification email delivery job failed", error)), env.jobIntervalMinutes * 60_000).unref();
}

function shutdown(signal) {
  console.log(`${signal} received. Closing HTTP server.`);
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
