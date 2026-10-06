import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { runMembershipLifecycleJob } from "./jobs/membership-lifecycle.job.js";
import { runNotificationEmailDeliveryJob } from "./jobs/notification-email-delivery.job.js";
import { runServiceLifecycleJob } from "./jobs/service-lifecycle.job.js";
import { createScheduledJobRunner } from "./jobs/scheduled-job-runner.js";

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`Sports Center API listening on http://localhost:${env.port}${env.apiBasePath}`);
});

if (env.jobsEnabled) {
  const jobs = [
    { name: "service_lifecycle", run: runServiceLifecycleJob, intervalMs: 60_000 },
    { name: "membership_lifecycle", run: runMembershipLifecycleJob, intervalMs: env.jobIntervalMinutes * 60_000 },
    { name: "notification_email_delivery", run: runNotificationEmailDeliveryJob, intervalMs: env.jobIntervalMinutes * 60_000 },
  ];
  for (const { name, run, intervalMs } of jobs) {
    const runOnce = createScheduledJobRunner({ name, run });
    void runOnce();
    setInterval(() => void runOnce(), intervalMs).unref();
  }
}

function shutdown(signal) {
  console.log(`${signal} received. Closing HTTP server.`);
  server.close(() => process.exit(0));
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
