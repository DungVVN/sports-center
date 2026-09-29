import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../api/auth-api.js";
import { TotpVerificationPage } from "./TotpVerificationPage.jsx";

vi.mock("../api/auth-api.js", () => ({ authApi: { verifyTotpLogin: vi.fn(), me: vi.fn() } }));

describe("TotpVerificationPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does not create a dashboard session until the six-digit MFA code succeeds", async () => {
    authApi.verifyTotpLogin.mockResolvedValue({ user: { role: "manager" } });
    authApi.me.mockResolvedValue({ user: { role: "manager" }, permissions: ["staff.manage"] });
    const onCompleted = vi.fn();
    render(<TotpVerificationPage challenge={{ challengeId: "challenge-1" }} onCancel={vi.fn()} onCompleted={onCompleted} />);
    const button = screen.getByRole("button", { name: "Xác thực" });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Mã xác thực"), { target: { value: "123456" } });
    fireEvent.click(button);
    await waitFor(() => expect(authApi.verifyTotpLogin).toHaveBeenCalledWith({ challengeId: "challenge-1", code: "123456" }));
    expect(onCompleted).toHaveBeenCalledWith({ user: { role: "manager" }, permissions: ["staff.manage"] });
  });
});
