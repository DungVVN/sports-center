import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/api-error.js";
import { authApi } from "./auth-api.js";
import { ProfilePage } from "./ProfilePage.jsx";

vi.mock("./auth-api.js", () => ({ authApi: { changePassword: vi.fn(), profile: vi.fn(), updateProfile: vi.fn() } }));
vi.mock("./TotpEnrollmentPanel.jsx", () => ({ TotpEnrollmentPanel: () => <div>MFA mock</div> }));
vi.mock("../notifications/NotificationPreferencesPage.jsx", () => ({ NotificationPreferencesPanel: () => <div>Thông báo mock</div> }));

const memberProfile = {
  id: "user-1",
  role: "member",
  status: "active",
  fullName: "Bình Nguyễn",
  memberCode: "HV-001",
  email: "binh@example.com",
  phone: "0900000000",
  contacts: [],
};
const memberSession = { user: { role: "member" }, permissions: [] };
let activeClient;

function renderPage(props = {}) {
  activeClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={activeClient}><ProfilePage session={memberSession} {...props} /></QueryClientProvider>);
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.profile.mockImplementation(() => Promise.resolve(memberProfile));
  });

  afterEach(() => {
    cleanup();
    activeClient?.clear();
    activeClient = undefined;
  });

  it("renders the profile-load error state", async () => {
    authApi.profile.mockRejectedValue(new Error("Không tải được hồ sơ."));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được hồ sơ.");
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
  });

  it("renders the empty emergency-contact state for a member", async () => {
    renderPage();
    expect(await screen.findByText(/Chưa có liên hệ khẩn cấp/)).toBeInTheDocument();
  });

  it("saves a profile and invokes the session update callback", async () => {
    const onProfileSaved = vi.fn();
    authApi.updateProfile.mockResolvedValue({ ...memberProfile, fullName: "Bình Trần" });
    renderPage({ onProfileSaved });
    fireEvent.change(await screen.findByLabelText("Họ tên"), { target: { value: "Bình Trần" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(authApi.updateProfile).toHaveBeenCalledWith({
      fullName: "Bình Trần",
      phone: "0900000000",
      dateOfBirth: null,
      avatarUrl: null,
      gender: null,
      contacts: [],
    }));
    expect(onProfileSaved).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent("Đã cập nhật hồ sơ cá nhân.");
  });

  it("shows an API 409 conflict when changing the password", async () => {
    authApi.changePassword.mockRejectedValue(new ApiError({ status: 409, message: "Mật khẩu hiện tại không đúng." }));
    renderPage();
    fireEvent.change(await screen.findByLabelText("Mật khẩu hiện tại"), { target: { value: "OldPassword1" } });
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "NewPassword1" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "NewPassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Mật khẩu hiện tại không đúng.");
  });
});
