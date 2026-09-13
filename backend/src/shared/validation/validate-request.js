import { AppError } from "../errors/app-error.js";

function formatIssues(issues) {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));
}

export function validateRequest(schema) {
  return (request, response, next) => {
    const result = schema.safeParse({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    if (!result.success) {
      return next(new AppError({
        statusCode: 422,
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên chưa hợp lệ.",
        details: formatIssues(result.error.issues),
      }));
    }

    request.validated = result.data;
    return next();
  };
}
