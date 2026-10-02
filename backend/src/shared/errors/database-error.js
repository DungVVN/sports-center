const unavailableCodes = new Set([
  "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN",
  "P1001", "P1002", "P1008", "P1017", "P2024",
]);

export function isDatabaseUnavailable(error) {
  // pg-pool acquisition timeouts can escape the Prisma adapter as plain Error.
  if (error?.name === "Error" && [
    "Connection terminated due to connection timeout",
    "timeout exceeded when trying to connect",
  ].includes(error.message)) return true;
  return typeof error?.name === "string"
    && error.name.startsWith("PrismaClient")
    && unavailableCodes.has(error.code ?? error.errorCode);
}
