export const emptyPackage = {
  code: "",
  name: "",
  priceVnd: "",
  durationDays: "30",
  tierRank: "",
  benefits: "",
  entitlements: [],
};

export const emptyFreeze = {
  membershipId: "",
  startsOn: "",
  endsOn: "",
  reason: "",
};

export const emptyMembership = {
  memberId: "",
  packageId: "",
  startsOn: new Date().toISOString().slice(0, 10),
};

export const membershipStatus = {
  pending_payment: "Chờ thanh toán",
  active: "Đang hoạt động",
  expiring_soon: "Sắp hết hạn",
  expired: "Đã hết hạn",
  frozen: "Đang đóng băng",
  cancelled: "Đã hủy",
};

export function membershipGraceLabel(membership) {
  if (membership.status !== "expiring_soon" || !membership.grace_expires_at)
    return "";
  return `Gia hạn không tính phí đến ${new Date(membership.grace_expires_at).toLocaleString("vi-VN")}`;
}

export const entitlementLabels = {
  gym_access: "Tập gym",
  group_class_booking: "Đặt lớp nhóm",
  pool_access: "Hồ bơi",
  sauna_access: "Xông hơi",
  towel_service: "Khăn tập",
  premium_locker: "Tủ đồ cao cấp",
  pt_session: "Buổi tập với PT",
};

export const packageTemplates = [
  { code: "BASIC", name: "Gói Cơ bản" },
  { code: "STANDARD", name: "Gói Tiêu chuẩn" },
  { code: "PREMIUM", name: "Gói Cao cấp" },
];

export function entitlementLabel(code) {
  return entitlementLabels[code] ?? "Quyền bổ sung";
}

export function estimatedExpiry(startsOn, durationDays) {
  if (!startsOn || !durationDays) return "";
  const expiresOn = new Date(`${startsOn}T00:00:00.000Z`);
  expiresOn.setUTCDate(expiresOn.getUTCDate() + durationDays);
  return expiresOn.toISOString().slice(0, 10);
}

export function validatePackageForm(form) {
  const code = form.code?.trim().toUpperCase();
  const name = form.name?.trim() || "";
  const priceText = String(form.priceVnd || "").trim();
  const durationText = String(form.durationDays || "").trim();
  const tierText = String(form.tierRank || "").trim();
  const priceVnd = Number(priceText);
  const durationDays = Number(durationText);
  const tierRank = Number(tierText);

  const errors = {};
  if (form.code !== undefined) {
    if (!code) errors.code = "Vui lòng nhập mã gói.";
    else if (!/^[A-Z0-9_-]{2,30}$/.test(code))
      errors.code = "Mã gói gồm 2–30 ký tự in hoa, số, _ hoặc -.";
  }
  if (!name) errors.name = "Vui lòng nhập tên gói.";
  else if (name.length < 2 || name.length > 100)
    errors.name = "Tên gói phải từ 2 đến 100 ký tự.";

  if (!priceText) errors.priceVnd = "Vui lòng nhập giá.";
  else if (
    !/^\d+$/.test(priceText) ||
    !Number.isSafeInteger(priceVnd) ||
    priceVnd < 0
  )
    errors.priceVnd = "Giá phải là số nguyên không âm.";

  if (!durationText) errors.durationDays = "Vui lòng nhập số ngày.";
  else if (
    !/^\d+$/.test(durationText) ||
    !Number.isSafeInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > 730
  )
    errors.durationDays = "Số ngày từ 1 đến 730.";

  if (!tierText) errors.tierRank = "Vui lòng nhập thứ hạng quyền.";
  else if (
    !/^\d+$/.test(tierText) ||
    !Number.isSafeInteger(tierRank) ||
    tierRank < 1
  )
    errors.tierRank = "Thứ hạng quyền phải >= 1.";

  if (Object.keys(errors).length > 0) return { errors };

  return {
    input: {
      ...form,
      code,
      name,
      priceVnd,
      durationDays,
      tierRank,
      benefits: (form.benefits || "")
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      entitlements: (form.entitlements || []).map((codeValue) => ({
        code: codeValue,
      })),
    },
  };
}

export function validateMembershipForm(form) {
  const errors = {};
  if (!form.memberId) errors.memberId = "Vui lòng chọn hội viên.";
  if (!form.packageId) errors.packageId = "Vui lòng chọn gói tập.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startsOn))
    errors.startsOn = "Vui lòng chọn ngày bắt đầu hợp lệ.";
  return errors;
}

export function validateFreezeForm(form) {
  const errors = {};
  if (!form.membershipId)
    errors.membershipId = "Vui lòng chọn gói đang hoạt động.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startsOn))
    errors.startsOn = "Vui lòng chọn ngày bắt đầu hợp lệ.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.endsOn))
    errors.endsOn = "Vui lòng chọn ngày kết thúc hợp lệ.";
  else if (form.startsOn && form.endsOn <= form.startsOn)
    errors.endsOn = "Ngày kết thúc phải sau ngày bắt đầu.";
  if (form.reason.trim().length < 3)
    errors.reason = "Lý do phải có ít nhất 3 ký tự.";
  return errors;
}
