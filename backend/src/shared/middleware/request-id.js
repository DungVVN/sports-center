import { randomUUID } from "node:crypto";

export function requestId(request, response, next) {
  const receivedId = request.get("x-request-id");
  request.id = receivedId && receivedId.length <= 128 ? receivedId : randomUUID();
  response.setHeader("x-request-id", request.id);
  next();
}
