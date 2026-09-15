export function sendSuccess(response, { statusCode = 200, data = null, meta } = {}) {
  const payload = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };

  // Prisma represents monetary columns as bigint. Normalize them at the HTTP
  // boundary so a successful mutation is never turned into a 500 while JSON
  // serialization is happening.
  const jsonPayload = JSON.parse(JSON.stringify(payload, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));
  return response.status(statusCode).json(jsonPayload);
}
