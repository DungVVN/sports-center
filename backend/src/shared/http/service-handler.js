import { sendSuccess } from "./response.js";

export function handleServiceRequest(action, statusCode = 200) {
  return async (req, res, next) => {
    try {
      const data = await action(req);
      sendSuccess(res, { statusCode, data });
    } catch (error) {
      next(error);
    }
  };
}
