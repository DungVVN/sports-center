export const roleLabels = {
  admin: "Quản trị hệ thống",
  manager: "Quản lý trung tâm",
  receptionist: "Lễ tân",
  coach: "Huấn luyện viên",
  member: "Hội viên",
};

export const statusLabels = { active: "Đang hoạt động", suspended: "Đình chỉ" };

export const emptyContact = {
  fullName: "",
  relationship: "",
  phone: "",
  isPrimary: false,
};

export function toForm(profile) {
  return {
    fullName: profile.fullName ?? "",
    phone: profile.phone ?? "",
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : "",
    avatarUrl: profile.avatarUrl ?? "",
    gender: profile.gender ?? "",
    contacts: profile.contacts ?? [],
  };
}
