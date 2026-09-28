import { describe, expect, it } from "vitest";
import { ApiError } from "./api-error.js";
import { errorMessageFor, fieldErrorsFor } from "./error-message.js";

describe("errorMessageFor", () => {
  it("keeps a concrete business error from the backend", () => {
    const error = new ApiError({ status: 409, code: "SLOT_FULL", message: "Lớp đã đủ chỗ. Vui lòng chọn lớp khác." });
    expect(errorMessageFor(error, "Không thể đặt chỗ.")).toBe("Lớp đã đủ chỗ. Vui lòng chọn lớp khác.");
  });

  it("shows the invalid field instead of a generic validation error", () => {
    const error = new ApiError({ status: 422, code: "VALIDATION_ERROR", message: "Dữ liệu không hợp lệ.", details: [{ path: "body.amountVnd", message: "Expected number, received string" }] });
    expect(fieldErrorsFor(error)).toEqual({ amountVnd: "Cần nhập số hợp lệ." });
    expect(errorMessageFor(error, "Không thể lập phiếu thu.")).toBe("Số tiền: Cần nhập số hợp lệ.");
  });

  it("explains missing permission in the context of the action without showing HTTP codes", () => {
    const error = new ApiError({ status: 403, code: "FORBIDDEN", message: "Bạn không có quyền thực hiện thao tác này." });
    expect(errorMessageFor(error, "Không thể lập phiếu thu.")).toContain("Không thể lập phiếu thu: tài khoản chưa được cấp quyền");
    expect(errorMessageFor(error, "Không thể lập phiếu thu.")).not.toContain("403");
  });

  it("does not replace a specific account restriction with a generic permission message", () => {
    const error = new ApiError({ status: 403, code: "ACCOUNT_NOT_ACTIVE", message: "Tài khoản đang chờ Lễ tân duyệt." });
    expect(errorMessageFor(error, "Không thể đăng nhập.")).toBe("Tài khoản đang chờ Lễ tân duyệt.");
  });

  it("does not invent a cause for an unknown server error", () => {
    const error = new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "Đã xảy ra lỗi hệ thống.", requestId: "req-42" });
    const message = errorMessageFor(error, "Không thể xác nhận thanh toán.");
    expect(message).toContain("Không thể xác nhận thanh toán: máy chủ chưa cung cấp nguyên nhân cụ thể.");
    expect(message).toContain("Mã tra cứu: req-42");
    expect(message).not.toContain("500");
  });

  it("names the attempted action when the network fails", () => {
    const error = new ApiError({ code: "NETWORK_ERROR", message: "Không nhận được phản hồi từ API. Kiểm tra kết nối mạng." });
    expect(errorMessageFor(error, "Không thể lưu điểm danh.")).toBe("Không thể lưu điểm danh: Không nhận được phản hồi từ API. Kiểm tra kết nối mạng.");
  });
});
