import { httpServerHandler } from "cloudflare:node";
import { DurableObject } from "cloudflare:workers";
import { createApp } from "../app.js";
import { env } from "../config/env.js";
import { createDatabaseClient } from "../database.js";
import { withRuntime } from "../shared/runtime/request-context.js";
import { runMembershipLifecycleJob } from "../jobs/membership-lifecycle.job.js";
import { runNotificationEmailDeliveryJob } from "../jobs/notification-email-delivery.job.js";
import { createDistributedLoginLimiter } from "./login-limiter.js";
export { LoginAttempts } from "./login-attempts.js";

createApp().listen(3000);
const handler = httpServerHandler({ port: 3000 });

function runtime(bindings) {
  if (!bindings.LOGIN_ATTEMPTS) throw new Error("LOGIN_ATTEMPTS binding is required.");
  return {
    database: createDatabaseClient(bindings.HYPERDRIVE?.connectionString || bindings.DATABASE_URL, { max: 3 }),
    loginLimiter: createDistributedLoginLimiter(bindings.LOGIN_ATTEMPTS, { maxAttempts: env.authLoginMaxAttempts, windowMinutes: env.authLoginWindowMinutes }),
  };
}

// Durable Objects have a separate CPU budget, including on Workers Free.
// Keep the edge handler small; the existing Express API runs inside these objects.
export class ApiRuntime extends DurableObject {
  async fetch(request) {
    const requestRuntime = runtime(this.env);
    try {
      return await withRuntime(requestRuntime, () => handler.fetch(request, this.env, this.ctx));
    } finally { this.ctx.waitUntil(requestRuntime.database.$disconnect()); }
  }
  async runJobs() {
    if (!env.jobsEnabled) return;
    const jobRuntime = runtime(this.env);
    try {
      await withRuntime(jobRuntime, async () => {
        await runMembershipLifecycleJob();
        await runNotificationEmailDeliveryJob();
      });
    } finally { await jobRuntime.database.$disconnect(); }
  }
}

export default {
  async fetch(request, bindings) {
    const shard = crypto.getRandomValues(new Uint32Array(1))[0] % 16;
    return bindings.API_RUNTIME.get(bindings.API_RUNTIME.idFromName(`api-${shard}`)).fetch(request);
  },
  async scheduled(_event, bindings) {
    if (!env.jobsEnabled) return;
    await bindings.API_RUNTIME.get(bindings.API_RUNTIME.idFromName("scheduled-jobs")).runJobs();
  },
};
