import { env } from "../../../config/env.js";
import { AppError } from "../../../shared/errors/app-error.js";

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

export function createVerificationDeliveryService({ config = env, fetchImpl = fetch } = {}) {
  return {
    async deliver({ channel, code, recipient, purpose = "registration" }) {
      if (config.verificationDeliveryMode === "development") {
        if (config.nodeEnv === "production") {
          throw new AppError({ statusCode: 503, code: "VERIFICATION_DELIVERY_NOT_CONFIGURED", message: "Production cần dịch vụ gửi email xác thực." });
        }
        return { delivered: true, developmentCode: code };
      }
      if (channel !== "email" || !config.resendApiKey || !config.resendFromEmail) {
        throw new AppError({
          statusCode: 503,
          code: "VERIFICATION_DELIVERY_NOT_CONFIGURED",
          message: "Dịch vụ gửi mã xác thực email chưa được cấu hình.",
        });
      }

      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: `${config.resendFromName} <${config.resendFromEmail}>`,
          to: [recipient],
          subject: purpose === "staff_login" ? "Mã đăng nhập Kinetic Sports" : "Mã xác thực tài khoản Kinetic Sports",
          text: `${purpose === "staff_login" ? "Mã đăng nhập" : "Mã xác thực"} của bạn là ${code}. Mã có hiệu lực trong ${config.verificationCodeTtlMinutes} phút. Không chia sẻ mã này với bất kỳ ai.`,
          html: `<p>${purpose === "staff_login" ? "Mã đăng nhập" : "Mã xác thực"} của bạn là <strong>${escapeHtml(code)}</strong>.</p><p>Mã có hiệu lực trong ${config.verificationCodeTtlMinutes} phút. Không chia sẻ mã này với bất kỳ ai.</p>`,
        }),
      });
      if (!response.ok) {
        console.error(`Resend verification delivery failed with status ${response.status}.`);
        throw new AppError({ statusCode: 503, code: "VERIFICATION_DELIVERY_FAILED", message: "Không thể gửi mã xác thực email. Vui lòng thử lại sau." });
      }
      return { delivered: true };
    },
  };
}

export const verificationDeliveryService = createVerificationDeliveryService();
