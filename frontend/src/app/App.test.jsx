import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.jsx";

vi.mock("../features/auth/LoginPage.jsx", () => ({
  LoginPage: ({ onLoggedIn }) => <div>
    <button onClick={() => onLoggedIn({ user: { role: "member", mustChangePassword: false, profileSetupRequired: true }, permissions: [] })}>Member login</button>
    <button onClick={() => onLoggedIn({ user: { role: "coach", mustChangePassword: true, profileSetupRequired: true }, permissions: [] })}>Coach login</button>
  </div>,
}));
vi.mock("../features/auth/AdminLoginPage.jsx", () => ({ AdminLoginPage: () => null }));
vi.mock("../features/auth/DashboardPlaceholder.jsx", () => ({ DashboardPlaceholder: ({ initialView, onProfileSaved }) => <div>Dashboard view: {initialView}<button onClick={onProfileSaved}>Save profile</button></div> }));
vi.mock("../features/auth/InitialPasswordChangePage.jsx", () => ({ InitialPasswordChangePage: ({ onCompleted }) => <button onClick={onCompleted}>Change temporary password</button> }));
vi.mock("../features/auth/PendingApprovalPage.jsx", () => ({ PendingApprovalPage: () => null }));
vi.mock("../features/auth/RegisterPage.jsx", () => ({ RegisterPage: () => null }));
vi.mock("../features/auth/VerificationPage.jsx", () => ({ VerificationPage: () => null }));
vi.mock("../features/auth/TotpVerificationPage.jsx", () => ({ TotpVerificationPage: () => null }));

describe("first login routing", () => {
  beforeEach(() => window.history.replaceState({}, "", "/"));
  afterEach(cleanup);
  it("opens the profile for a self-registered Member without a password-change step", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    fireEvent.click(screen.getByText("Member login"));
    expect(screen.getByText("Dashboard view: profile")).toBeInTheDocument();
    expect(screen.queryByText("Change temporary password")).not.toBeInTheDocument();
  });

  it("requires a temporary-password change before opening the Coach profile", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    fireEvent.click(screen.getByText("Coach login"));
    expect(screen.getByText("Change temporary password")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Change temporary password"));
    expect(screen.getByText("Dashboard view: profile")).toBeInTheDocument();
  });
});
