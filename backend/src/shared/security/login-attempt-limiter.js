import { AppError } from "../errors/app-error.js";
import { currentRuntime } from "../runtime/request-context.js";

export function createLoginAttemptLimiter({ maxAttempts, windowMinutes }) {
  const entries = new Map();
  const windowMs = windowMinutes * 60_000;

  function prune(key, now) {
    const attempts = (entries.get(key) ?? []).filter((value) => now - value < windowMs);
    if (attempts.length) entries.set(key, attempts);
    else entries.delete(key);
    return attempts;
  }

  return Object.freeze({
    assertAllowed(key, now = Date.now()) {
      if (currentRuntime()?.loginLimiter) return currentRuntime().loginLimiter.assertAllowed(key, now);
      if (prune(key, now).length >= maxAttempts) {
        throw new AppError({ statusCode: 429, code: "LOGIN_ATTEMPTS_EXCEEDED", message: "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau." });
      }
    },
    recordFailure(key, now = Date.now()) {
      if (currentRuntime()?.loginLimiter) return currentRuntime().loginLimiter.recordFailure(key, now);
      const attempts = prune(key, now);
      attempts.push(now);
      entries.set(key, attempts);
    },
    clear(key) {
      if (currentRuntime()?.loginLimiter) return currentRuntime().loginLimiter.clear(key);
      entries.delete(key);
    },
  });
}
