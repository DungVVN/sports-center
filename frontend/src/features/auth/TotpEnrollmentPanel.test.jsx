import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./auth-api.js";
import { TotpEnrollmentPanel } from "./TotpEnrollmentPanel.jsx";

vi.mock("./auth-api.js", () => ({ authApi: { beginTotpEnrollment: vi.fn(), confirmTotpEnrollment: vi.fn() } }));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,qr-code") } }));

describe("TotpEnrollmentPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reveals the manual setup secret only during enrollment and confirms it with a six-digit code", async () => {
    authApi.beginTotpEnrollment.mockResolvedValue({
      enrollmentId: "enrollment-1",
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/Kinetic%20Sports:test@example.com?secret=JBSWY3DPEHPK3PXP",
    });
    authApi.confirmTotpEnrollment.mockResolvedValue({ enrolled: true });
    const onEnrollmentCompleted = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><TotpEnrollmentPanel onEnrollmentCompleted={onEnrollmentCompleted} /></QueryClientProvider>);
    expect(screen.getByText("Sau khi thiết lập, bạn sẽ dùng mã 6 số từ ứng dụng Authenticator khi đăng nhập.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập Authenticator" }));
    expect(await screen.findByRole("img", { name: "Mã QR thiết lập Authenticator" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Mã 6 số"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận Authenticator" }));
    await waitFor(() => expect(authApi.confirmTotpEnrollment).toHaveBeenCalledWith({ enrollmentId: "enrollment-1", code: "123456" }));
    expect(onEnrollmentCompleted).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Lần đăng nhập tiếp theo sẽ yêu cầu mã 6 số");
  });
});
