import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.jsx";

const mockAuthMe = vi.hoisted(() => vi.fn());
const mockPortalSurface = vi.hoisted(() => vi.fn(() => "main"));

vi.mock("../config/portal.js", () => ({ portalSurface: mockPortalSurface }));

vi.mock("../features/auth/auth-api.js", () => ({
  authApi: {
    me: mockAuthMe,
    verifyAdminTotpLogin: vi.fn(),
    verifyTotpLogin: vi.fn(),
  },
}));

vi.mock("../features/auth/LoginPage.jsx", () => ({
  LoginPage: ({ onLoggedIn }) => <div>
    <button onClick={() => onLoggedIn({ user: { id: "member-1", role: "member", mustChangePassword: false, profileSetupRequired: true }, permissions: [] })}>Member login</button>
    <button onClick={() => onLoggedIn({ user: { id: "coach-2", role: "coach", mustChangePassword: true, profileSetupRequired: true }, permissions: [] })}>Coach login</button>
  </div>,
}));
vi.mock("../features/auth/AdminLoginPage.jsx", () => ({ AdminLoginPage: () => null }));
vi.mock("../features/auth/DashboardPlaceholder.jsx", () => ({ DashboardPlaceholder: ({ initialView, onProfileSaved, session }) => <div>Dashboard view: {initialView}; account: {session.user.id}<button onClick={onProfileSaved}>Save profile</button></div> }));
vi.mock("../features/auth/InitialPasswordChangePage.jsx", () => ({ InitialPasswordChangePage: ({ onCompleted }) => <button onClick={onCompleted}>Change temporary password</button> }));
vi.mock("../features/auth/PendingApprovalPage.jsx", () => ({ PendingApprovalPage: () => null }));
vi.mock("../features/auth/RegisterPage.jsx", () => ({ RegisterPage: () => null }));
vi.mock("../features/auth/VerificationPage.jsx", () => ({ VerificationPage: () => null }));
vi.mock("../features/auth/TotpVerificationPage.jsx", () => ({ TotpVerificationPage: () => null }));

describe("first login routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    mockAuthMe.mockReset();
    mockAuthMe.mockRejectedValue(new Error("No active session"));
    mockPortalSurface.mockReturnValue("main");
  });
  afterEach(cleanup);
  it("opens the profile for a self-registered Member without a password-change step", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /đăng nhập/i }));
    fireEvent.click(screen.getByText("Member login"));
    expect(screen.getByText("Dashboard view: profile; account: member-1")).toBeInTheDocument();
    expect(screen.queryByText("Change temporary password")).not.toBeInTheDocument();
  });

  it("requires a temporary-password change before opening the Coach profile", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /đăng nhập/i }));
    fireEvent.click(screen.getByText("Coach login"));
    expect(screen.getByText("Change temporary password")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Change temporary password"));
    expect(screen.getByText("Dashboard view: profile; account: coach-2")).toBeInTheDocument();
  });

  it("restores a valid browser session after a page refresh", async () => {
    mockAuthMe.mockResolvedValue({
      user: { id: "member-1", role: "member", mustChangePassword: false, profileSetupRequired: false },
      permissions: [],
    });

    render(<App />);

    expect(await screen.findByText("Dashboard view: dashboard; account: member-1")).toBeInTheDocument();
  });

  it("does not restore an Admin session on the main portal", async () => {
    mockAuthMe.mockResolvedValue({ user: { role: "admin", mustChangePassword: false, profileSetupRequired: false }, permissions: [] });
    render(<App />);
    expect(await screen.findByRole("button", { name: /đăng nhập/i })).toBeInTheDocument();
    expect(screen.queryByText(/Dashboard view: dashboard/)).not.toBeInTheDocument();
  });

  it("restores only the Admin session on the Admin portal", async () => {
    mockPortalSurface.mockReturnValue("admin");
    mockAuthMe.mockResolvedValue({ user: { id: "admin-1", role: "admin", mustChangePassword: false, profileSetupRequired: false }, permissions: [] });
    render(<App />);
    expect(await screen.findByText("Dashboard view: dashboard; account: admin-1")).toBeInTheDocument();
  });

  it("switches an existing main-portal tab to the account logged in by another tab", async () => {
    mockAuthMe.mockResolvedValueOnce({ user: { id: "member-1", role: "member", mustChangePassword: false, profileSetupRequired: false }, permissions: [] });
    render(<App />);
    expect(await screen.findByText("Dashboard view: dashboard; account: member-1")).toBeInTheDocument();

    mockAuthMe.mockResolvedValueOnce({ user: { id: "coach-2", role: "coach", mustChangePassword: false, profileSetupRequired: false }, permissions: [] });
    fireEvent(window, new StorageEvent("storage", { key: "sports-center:session-change" }));

    expect(await screen.findByText("Dashboard view: dashboard; account: coach-2")).toBeInTheDocument();
    expect(screen.queryByText(/account: member-1/)).not.toBeInTheDocument();
  });

  it("shows a 404 page for an unknown frontend route", async () => {
    window.history.replaceState({}, "", "/khong-ton-tai");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Không tìm thấy trang" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/khong-ton-tai");
  });
});
