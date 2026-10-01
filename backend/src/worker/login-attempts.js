import { DurableObject } from "cloudflare:workers";

export class LoginAttempts extends DurableObject {
  async allowed(now, maxAttempts, windowMs) {
    const attempts = (await this.ctx.storage.get("attempts") ?? []).filter((time) => now - time < windowMs);
    return attempts.length < maxAttempts;
  }

  async failure(now, windowMs) {
    await this.ctx.storage.transaction(async (storage) => {
      const attempts = (await storage.get("attempts") ?? []).filter((time) => now - time < windowMs);
      attempts.push(now);
      await storage.put("attempts", attempts);
    });
    await this.ctx.storage.setAlarm(now + windowMs);
  }

  async clear() {
    await this.ctx.storage.deleteAll();
    await this.ctx.storage.deleteAlarm();
  }

  async alarm() { await this.ctx.storage.deleteAll(); }
}
