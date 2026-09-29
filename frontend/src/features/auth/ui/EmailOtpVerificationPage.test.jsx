import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../api/auth-api.js";
import { EmailOtpVerificationPage } from "./EmailOtpVerificationPage.jsx";

vi.mock("../api/auth-api.js", () => ({ authApi: { verifyStaffEmailOtp: vi.fn(), me: vi.fn() } }));

describe("EmailOtpVerificationPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("waits for a valid email OTP before entering the staff dashboard", async () => {
    authApi.verifyStaffEmailOtp.mockResolvedValue({ user: { role: "coach" } });
    authApi.me.mockResolvedValue({ user: { role: "coach" }, permissions: ["class.read"] });
    const onCompleted = vi.fn();
    render(<EmailOtpVerificationPage challenge={{ challengeId: "challenge-1" }} onCancel={vi.fn()} onCompleted={onCompleted} />);
    fireEvent.change(screen.getByLabelText("Mã đăng nhập"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác thực và đăng nhập" }));
    await waitFor(() => expect(authApi.verifyStaffEmailOtp).toHaveBeenCalledWith({ challengeId: "challenge-1", code: "123456" }));
    expect(onCompleted).toHaveBeenCalledWith({ user: { role: "coach" }, permissions: ["class.read"] });
  });
});
