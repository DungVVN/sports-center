import { describe, expect, it } from "vitest";
import { validateCredentials, validateRegistration } from "./auth-validation.js";

describe("auth validation", () => {
  it("reports an invalid email before submit", () => {
    expect(validateCredentials({ email: "sai-email", password: "secret" }).email).toBe("Email chưa đúng định dạng.");
  });

  it("reports password strength, phone format and confirmation separately", () => {
    const errors = validateRegistration({ fullName: "An", email: "an@example.com", phone: "123", password: "lowercase", confirmPassword: "different" });
    expect(errors.phone).toBe("Số điện thoại Việt Nam chưa hợp lệ.");
    expect(errors.password).toBe("Mật khẩu cần có chữ hoa.");
    expect(errors.confirmPassword).toBe("Mật khẩu xác nhận không khớp.");
  });
});
