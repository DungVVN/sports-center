export class ApiError extends Error {
  constructor({ code = "NETWORK_ERROR", message, details, status }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}
