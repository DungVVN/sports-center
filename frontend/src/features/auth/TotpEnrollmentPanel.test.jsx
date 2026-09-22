import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "./auth-api.js";
import { TotpEnrollmentPanel } from "./TotpEnrollmentPanel.jsx";

vi.mock("./auth-api.js", () => ({ authApi: { beginTotpEnrollment: vi.fn(), confirmTotpEnrollment: vi.fn() } }));

describe("TotpEnrollmentPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reveals the manual setup secret only during enrollment and confirms it with a six-digit code", async () => {
    authApi.beginTotpEnrollment.mockResolvedValue({ enrollmentId: "enrollment-1", secret: "JBSWY3DPEHPK3PXP" });
    authApi.confirmTotpEnrollment.mockResolvedValue({ enrolled: true });
    const onEnrollmentCompleted = vi.fn();
    render(<TotpEnrollmentPanel onEnrollmentCompleted={onEnrollmentCompleted} />);
    fireEvent.click(screen.getByRole("button", { name: "Thiết lập Authenticator" }));
    expect(await screen.findByDisplayValue("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Mã 6 số"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận Authenticator" }));
    await waitFor(() => expect(authApi.confirmTotpEnrollment).toHaveBeenCalledWith({ enrollmentId: "enrollment-1", code: "123456" }));
    expect(onEnrollmentCompleted).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Authenticator đã được kích hoạt");
  });
});
