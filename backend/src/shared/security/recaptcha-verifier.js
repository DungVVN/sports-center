import { AppError } from "../errors/app-error.js";

const verifyUrl = "https://www.google.com/recaptcha/api/siteverify";

/**
 * Google reCAPTCHA verification must occur on the API, never solely in the
 * browser.  Keeping this small adapter injectable also makes auth tests fully
 * deterministic and avoids outbound calls when CAPTCHA is disabled locally.
 */
export function createRecaptchaVerifier({ enabled, secretKey, fetchImpl = globalThis.fetch }) {
  return {
    async assertValid(token) {
      if (!enabled) return;
      if (!token) {
        throw new AppError({ statusCode: 422, code: "CAPTCHA_REQUIRED", message: "Vui lòng xác minh CAPTCHA trước khi tiếp tục." });
      }
      if (!fetchImpl) {
        throw new AppError({ statusCode: 503, code: "CAPTCHA_UNAVAILABLE", message: "Dịch vụ CAPTCHA hiện chưa sẵn sàng." });
      }

      let result;
      try {
        const body = new URLSearchParams({ secret: secretKey, response: token });
        const response = await fetchImpl(verifyUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
        result = await response.json();
      } catch {
        throw new AppError({ statusCode: 503, code: "CAPTCHA_UNAVAILABLE", message: "Không thể xác minh CAPTCHA. Vui lòng thử lại." });
      }
      if (!result?.success) {
        throw new AppError({ statusCode: 422, code: "CAPTCHA_INVALID", message: "Xác minh CAPTCHA không hợp lệ hoặc đã hết hạn." });
      }
    },
  };
}
