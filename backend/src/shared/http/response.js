export function sendSuccess(response, { statusCode = 200, data = null, meta } = {}) {
  return response.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}
