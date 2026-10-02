import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.jsx";
import { ApiError } from "../shared/api/api-error.js";

const mockAuthMe = vi.hoisted(() => vi.fn());
const mockPortalSurface = vi.hoisted(() => vi.fn(() => "main"));
const mockPageByPath = vi.hoisted(() => vi.fn());

vi.mock("../features/site/api/site-public-api.js", async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, publicSiteApi: { ...original.publicSiteApi, pageByPath: mockPageByPath, menu: vi.fn().mockResolvedValue([]) } };
});

vi.mock("../config/portal.js", () => ({ portalSurface: mockPortalSurface }));

vi.mock("../features/auth/api/auth-api.js", () => ({
  authApi: {
    me: mockAuthMe,
    verifyAdminTotpLogin: vi.fn(),
    verifyTotpLogin: vi.fn(),
  },
}));

vi.mock("../features/auth/ui/LoginPage.jsx", () => ({
  LoginPage: ({ onLoggedIn }) => <div>
    <button onClick={() => onLoggedIn({ user: { id: "member-1", role: "member", mustChangePassword: false, profileSetupRequired: true }, permissions: [] })}>Member login</button>
    <button onClick={() => onLoggedIn({ user: { id: "coach-2", role: "coach", mustChangePassword: true, profileSetupRequired: true }, permissions: [] })}>Coach login</button>
  </div>,
}));
vi.mock("../features/auth/ui/AdminLoginPage.jsx", () => ({ AdminLoginPage: () => <div>Admin login page</div> }));
vi.mock("./composition/DashboardPlaceholder.jsx", () => ({ DashboardPlaceholder: ({ initialView, onProfileSaved, session }) => <div>Dashboard view: {initialView}; account: {session.user.id}<button onClick={onProfileSaved}>Save profile</button></div> }));
vi.mock("../features/auth/ui/InitialPasswordChangePage.jsx", () => ({ InitialPasswordChangePage: ({ onCompleted }) => <button onClick={onCompleted}>Change temporary password</button> }));
vi.mock("../features/auth/ui/PendingApprovalPage.jsx", () => ({ PendingApprovalPage: () => null }));
vi.mock("../features/auth/ui/RegisterPage.jsx", () => ({ RegisterPage: () => null }));
vi.mock("../features/auth/ui/VerificationPage.jsx", () => ({ VerificationPage: () => null }));
vi.mock("../features/auth/ui/TotpVerificationPage.jsx", () => ({ TotpVerificationPage: () => null }));

describe("first login routing", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    mockAuthMe.mockReset();
    mockAuthMe.mockRejectedValue(new Error("No active session"));
    mockPortalSurface.mockReturnValue("main");
    mockPageByPath.mockReset().mockRejectedValue(new ApiError({ status: 404, code: "NOT_FOUND" }));
  });
  afterEach(cleanup);
  it.each(["/gallery", "/calendar"])("preserves the published CMS SEO title at %s", async (path) => {
    window.history.replaceState({}, "", path);
    const previousTitle = document.title;
    const bootstrap = document.createElement("script");
    bootstrap.id = "public-page-data";
    bootstrap.type = "application/json";
    bootstrap.textContent = JSON.stringify({ path, page: { title: "Trang hoạt động", seoTitle: "Tiêu đề SEO do admin xuất bản", blocks: [{ id: "activity-hero", type: "hero", active: true, title: "Nội dung quản lý bằng CMS" }] } });
    document.head.appendChild(bootstrap);
    const result = render(<App />);
    try {
      expect(await screen.findByRole("heading", { name: "Nội dung quản lý bằng CMS" })).toBeInTheDocument();
      expect(document.title).toBe("Tiêu đề SEO do admin xuất bản");
    } finally {
      result.unmount();
      bootstrap.remove();
      document.title = previousTitle;
    }
  });
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

  it("shows the public home immediately while session lookup is pending", () => {
    mockAuthMe.mockReturnValue(new Promise(() => {}));

    render(<App />);

    expect(screen.getByRole("button", { name: /đăng nhập/i })).toBeInTheDocument();
    expect(screen.queryByText("Đang khôi phục phiên đăng nhập...")).not.toBeInTheDocument();
  });

  it("does not replace a new login with a stale session lookup", async () => {
    let finishLookup;
    mockAuthMe.mockReturnValue(new Promise((resolve) => { finishLookup = resolve; }));

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /đăng nhập/i }));
    fireEvent.click(screen.getByText("Member login"));
    expect(screen.getByText("Dashboard view: profile; account: member-1")).toBeInTheDocument();

    await act(async () => {
      finishLookup({ user: { id: "old-member", role: "member", mustChangePassword: false, profileSetupRequired: false }, permissions: [] });
    });
    expect(screen.getByText("Dashboard view: profile; account: member-1")).toBeInTheDocument();
    expect(screen.queryByText(/old-member/)).not.toBeInTheDocument();
  });

  it("keeps a private route hidden until its session lookup completes", async () => {
    window.history.replaceState({}, "", "/members");
    let finishLookup;
    mockAuthMe.mockReturnValue(new Promise((resolve) => { finishLookup = resolve; }));

    render(<App />);

    expect(screen.getByLabelText("Đang tải tài khoản")).toBeInTheDocument();
    expect(screen.queryByText("Member login")).not.toBeInTheDocument();
    finishLookup({ user: { id: "member-1", role: "member", mustChangePassword: false, profileSetupRequired: false }, permissions: [] });
    expect(await screen.findByText("Dashboard view: members; account: member-1")).toBeInTheDocument();
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

  it("restores an Admin session on a deep workspace route after refresh", async () => {
    window.history.replaceState({}, "", "/members");
    mockPortalSurface.mockReturnValue("admin");
    mockAuthMe.mockResolvedValue({ user: { id: "admin-1", role: "admin", mustChangePassword: false, profileSetupRequired: false }, permissions: [] });

    render(<App />);

    expect(await screen.findByText("Dashboard view: members; account: admin-1")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/members");
  });

  it("shows Admin login instead of 404 on a deep route without a session", async () => {
    window.history.replaceState({}, "", "/admin/permissions");
    mockPortalSurface.mockReturnValue("admin");

    render(<App />);

    expect(await screen.findByText("Admin login page")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Không tìm thấy trang" })).not.toBeInTheDocument();
  });

  it("keeps unknown Admin routes as 404", async () => {
    window.history.replaceState({}, "", "/khong-ton-tai");
    mockPortalSurface.mockReturnValue("admin");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Không tìm thấy trang" })).toBeInTheDocument();
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

  it("keeps a database outage distinct from an unknown public route", async () => {
    mockPageByPath.mockRejectedValue(new ApiError({ status: 503, code: "DATABASE_UNAVAILABLE" }));
    window.history.replaceState({}, "", "/dich-vu");
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Không thể tải trang" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Không tìm thấy trang" })).not.toBeInTheDocument();
  });
});
