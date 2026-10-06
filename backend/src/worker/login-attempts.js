import { DurableObject } from "cloudflare:workers";

export class LoginAttempts extends DurableObject {
  async consume(now, maxAttempts, windowMs) {
    const accepted = await this.ctx.storage.transaction(async (storage) => {
      const attempts = (await storage.get("attempts") ?? []).filter((time) => now - time < windowMs);
      if (attempts.length >= maxAttempts) return false;
      attempts.push(now);
      await storage.put("attempts", attempts);
      return true;
    });
    if (accepted) await this.ctx.storage.setAlarm(now + windowMs);
    return accepted;
  }

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
