import { describe, expect, it } from "vitest";
import { validateCredentials, validateRegistration } from "./auth-validation.js";

describe("auth validation", () => {
  it("reports an invalid email before submit", () => {
    expect(validateCredentials({ email: "sai-email", password: "secret" }).email).toBe("Email chưa đúng định dạng.");
  });

  it("reports password strength, phone format and confirmation separately", () => {
    const errors = validateRegistration({ fullName: "An", email: "an@example.com", phone: "123", password: "lowercase", confirmPassword: "different" });
    expect(errors.phone).toBe("Nhập số bắt đầu bằng 0 hoặc +84, theo sau là 9–10 chữ số (ví dụ 0901234567).");
    expect(errors.password).toBe("Mật khẩu cần có chữ hoa.");
    expect(errors.confirmPassword).toBe("Mật khẩu xác nhận không khớp.");
  });
});
