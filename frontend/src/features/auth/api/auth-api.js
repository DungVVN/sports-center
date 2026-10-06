import { apiClient } from "../../../shared/api/client.js";

export const authApi = Object.freeze({
  login: (input) => apiClient.post("/auth/login", input),
  adminLogin: (input) => apiClient.post("/auth/admin/login", input),
  verifyTotpLogin: (input) => apiClient.post("/auth/mfa/totp/verify", input),
  verifyAdminTotpLogin: (input) => apiClient.post("/auth/admin/mfa/totp/verify", input),
  verifyStaffEmailOtp: (input) => apiClient.post("/auth/mfa/email/verify", input),
  beginTotpEnrollment: () => apiClient.post("/auth/mfa/totp/enrollment"),
  confirmTotpEnrollment: (input) => apiClient.post("/auth/mfa/totp/enrollment/confirm", input),
  logout: () => apiClient.post("/auth/logout"),
  register: (input) => apiClient.post("/auth/register", input),
  confirmVerification: (input) => apiClient.post("/auth/verification/confirm", input),
  resendVerification: (input) => apiClient.post("/auth/verification/resend", input),
  me: (options) => apiClient.get("/auth/me", options),
  profile: () => apiClient.get("/auth/profile"),
  updateProfile: (input) => apiClient.patch("/auth/profile", input),
  cloudinaryProfileAvatarSignature: () => apiClient.post("/auth/profile/avatar/cloudinary/signature"),
  changePassword: (input) => apiClient.post("/auth/password/change", input),
  pendingRegistrations: () => apiClient.get("/auth/registrations/pending"),
  approveRegistration: (userId) => apiClient.post(`/auth/registrations/${userId}/approve`),
});
