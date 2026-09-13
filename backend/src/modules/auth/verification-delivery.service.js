import { env } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

export const verificationDeliveryService = {
  async deliver({ channel, code, recipient }) {
    if (env.verificationDeliveryMode === "development") {
      console.info(`Development ${channel} verification code for ${recipient}: ${code}`);
      return { delivered: true, developmentCode: code };
    }
    throw new AppError({
      statusCode: 503,
      code: "VERIFICATION_DELIVERY_NOT_CONFIGURED",
      message: "Dịch vụ gửi mã xác thực chưa được cấu hình.",
    });
  },
};
