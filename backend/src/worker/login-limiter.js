import { createHash } from "node:crypto";
import { AppError } from "../shared/errors/app-error.js";

export function createDistributedLoginLimiter(binding, { maxAttempts, windowMinutes }) {
  const stub = (key) => binding.get(binding.idFromName(createHash("sha256").update(key).digest("hex")));
  return {
    async assertAllowed(key, now) {
      if (!await stub(key).allowed(now, maxAttempts, windowMinutes * 60_000)) {
        throw new AppError({ statusCode: 429, code: "LOGIN_ATTEMPTS_EXCEEDED", message: "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau." });
      }
    },
    recordFailure: (key, now) => stub(key).failure(now, windowMinutes * 60_000),
    clear: (key) => stub(key).clear(),
  };
}
