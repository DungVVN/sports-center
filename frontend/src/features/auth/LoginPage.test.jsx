import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/api-error.js";
import { authApi } from "./auth-api.js";
import { LoginPage } from "./LoginPage.jsx";

vi.mock("./auth-api.js", () => ({ authApi: { login: vi.fn(), me: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginPage", () => {
  it("submits credentials and returns the API session to the app", async () => {
    const onLoggedIn = vi.fn();
    authApi.login.mockResolvedValue({ user: { role: "manager" } });
    authApi.me.mockResolvedValue({ user: { role: "manager" }, permissions: ["training.template.manage"] });
    render(<LoginPage onLoggedIn={onLoggedIn} onMfaRequired={vi.fn()} onRegister={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "manager01@sportscenter.local" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "test-only-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalledWith({ email: "manager01@sportscenter.local", password: "test-only-password" }));
    expect(onLoggedIn).toHaveBeenCalledWith({ user: { role: "manager" }, permissions: ["training.template.manage"] });
  });

  it("shows the normalized backend error and keeps the user on the form", async () => {
    authApi.login.mockRejectedValue(new ApiError({ code: "INVALID_CREDENTIALS", message: "Email hoặc mật khẩu không đúng." }));
    render(<LoginPage onLoggedIn={vi.fn()} onMfaRequired={vi.fn()} onRegister={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "manager01@sportscenter.local" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "sai-mat-khau" } });
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email hoặc mật khẩu không đúng.");
  });
});
