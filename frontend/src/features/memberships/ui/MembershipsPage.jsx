import { useMemo, useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { DataTableToolbar, FilterMenu, SortableHeader } from "../../../shared/ui/DataTable.jsx";
import { Dialog } from "../../../shared/ui/Dialog.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { TableSkeleton } from "../../../shared/ui/TableSkeleton.jsx";
import { usePagination } from "../../../shared/ui/usePagination.js";
import { sortTable } from "../../../shared/lib/table.js";
import { hasSessionPermission } from "../../auth/index.js";
import { useMutationFeedback } from "../../../shared/lib/useMutationFeedback.js";
import { errorMessageFor, fieldErrorsFor } from "../../../shared/api/error-message.js";
import { useMembershipWorkspace } from "../api/useMembershipWorkspace.js";
import "./membership-layout.css";

const emptyPackage = {
  code: "",
  name: "",
  priceVnd: "",
  durationDays: "30",
  tierRank: "",
  benefits: "",
  entitlements: [],
};
const emptyFreeze = { membershipId: "", startsOn: "", endsOn: "", reason: "" };
const emptyMembership = {
  memberId: "",
  packageId: "",
  startsOn: new Date().toISOString().slice(0, 10),
};
const membershipStatus = {
  pending_payment: "Chờ thanh toán",
  active: "Đang hoạt động",
  expiring_soon: "Sắp hết hạn",
  expired: "Đã hết hạn",
  frozen: "Đang đóng băng",
  cancelled: "Đã hủy",
};

function membershipGraceLabel(membership) {
  if (membership.status !== "expiring_soon" || !membership.grace_expires_at) return "";
  return `Gia hạn không tính phí đến ${new Date(membership.grace_expires_at).toLocaleString("vi-VN")}`;
}
const entitlementLabels = {
  gym_access: "Tập gym",
  group_class_booking: "Đặt lớp nhóm",
  pool_access: "Hồ bơi",
  sauna_access: "Xông hơi",
  towel_service: "Khăn tập",
  premium_locker: "Tủ đồ cao cấp",
  pt_session: "Buổi tập với PT",
};
const packageTemplates = [
  { code: "BASIC", name: "Gói Cơ bản" },
  { code: "STANDARD", name: "Gói Tiêu chuẩn" },
  { code: "PREMIUM", name: "Gói Cao cấp" },
];

function entitlementLabel(code) {
  return entitlementLabels[code] ?? "Quyền bổ sung";
}

function estimatedExpiry(startsOn, durationDays) {
  if (!startsOn || !durationDays) return "";
  const expiresOn = new Date(`${startsOn}T00:00:00.000Z`);
  expiresOn.setUTCDate(expiresOn.getUTCDate() + durationDays);
  return expiresOn.toISOString().slice(0, 10);
}

function validatePackageForm(form) {
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
    else if (!/^[A-Z0-9_-]{2,30}$/.test(code)) errors.code = "Mã gói gồm 2–30 ký tự in hoa, số, _ hoặc -.";
  }
  if (!name) errors.name = "Vui lòng nhập tên gói.";
  else if (name.length < 2 || name.length > 100) errors.name = "Tên gói phải từ 2 đến 100 ký tự.";

  if (!priceText) errors.priceVnd = "Vui lòng nhập giá.";
  else if (!/^\d+$/.test(priceText) || !Number.isSafeInteger(priceVnd) || priceVnd < 0) errors.priceVnd = "Giá phải là số nguyên không âm.";

  if (!durationText) errors.durationDays = "Vui lòng nhập số ngày.";
  else if (!/^\d+$/.test(durationText) || !Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 730) errors.durationDays = "Số ngày từ 1 đến 730.";

  if (!tierText) errors.tierRank = "Vui lòng nhập thứ hạng quyền.";
  else if (!/^\d+$/.test(tierText) || !Number.isSafeInteger(tierRank) || tierRank < 1) errors.tierRank = "Thứ hạng quyền phải >= 1.";

  if (Object.keys(errors).length > 0) return { errors };

  return {
    input: {
      ...form,
      code,
      name,
      priceVnd,
      durationDays,
      tierRank,
      benefits: (form.benefits || "").split("\n").map((value) => value.trim()).filter(Boolean),
      entitlements: (form.entitlements || []).map((codeValue) => ({ code: codeValue })),
    },
  };
}

function validateMembershipForm(form) {
  const errors = {};
  if (!form.memberId) errors.memberId = "Vui lòng chọn hội viên.";
  if (!form.packageId) errors.packageId = "Vui lòng chọn gói tập.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startsOn)) errors.startsOn = "Vui lòng chọn ngày bắt đầu hợp lệ.";
  return errors;
}

function validateFreezeForm(form) {
  const errors = {};
  if (!form.membershipId) errors.membershipId = "Vui lòng chọn gói đang hoạt động.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.startsOn)) errors.startsOn = "Vui lòng chọn ngày bắt đầu hợp lệ.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.endsOn)) errors.endsOn = "Vui lòng chọn ngày kết thúc hợp lệ.";
  else if (form.startsOn && form.endsOn <= form.startsOn) errors.endsOn = "Ngày kết thúc phải sau ngày bắt đầu.";
  if (form.reason.trim().length < 3) errors.reason = "Lý do phải có ít nhất 3 ký tự.";
  return errors;
}

export function MembershipsPage({ mode = "workspace", session }) {
  const role = session?.user?.role;
  const isMember = role === "member" && mode === "workspace";
  const canCreatePackages = hasSessionPermission(session, "membership.package.manage");
  const isManager = canCreatePackages || (mode === "catalog" && hasSessionPermission(session, "membership.package.read"));
  const isReceptionist = !isManager && hasSessionPermission(session, "membership.assign");
  const canAssignMembership = hasSessionPermission(session, "membership.assign");
  const canReviewFreeze = hasSessionPermission(session, "membership.freeze.review");
  const showManagerCreate = canCreatePackages && ["workspace", "create"].includes(mode);
  const showManagerCatalog = isManager && ["workspace", "catalog"].includes(mode);
  const showAssignment = canAssignMembership && (!isManager || mode === "assign");
  const packagePageLayout = isManager && mode === "create" ? " package-page-layout package-page-layout--create" : isManager && mode === "catalog" ? " package-page-layout package-page-layout--catalog" : "";
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const {
    cancelPendingRenewal: cancelPendingRenewalMutation,
    createMembership: createMembershipMutation,
    createPackage: createPackageMutation,
    error: queryError,
    freezeRequests,
    loading,
    members,
    memberships,
    packages,
    reload: load,
    requestFreeze: requestFreezeMutation,
    reviewFreeze: reviewFreezeMutation,
    updatePackage: updatePackageMutation,
  } = useMembershipWorkspace({
    canAssignMembership,
    canReviewFreeze,
    isManager,
    isMember,
    selectedMemberId,
  });
  const [packageForm, setPackageForm] = useState(emptyPackage);
  const [packageFormErrors, setPackageFormErrors] = useState({});
  const [freezeForm, setFreezeForm] = useState(emptyFreeze);
  const [freezeTouched, setFreezeTouched] = useState({});
  const [membershipForm, setMembershipForm] = useState(emptyMembership);
  const [membershipTouched, setMembershipTouched] = useState({});
  const freezeErrors = validateFreezeForm(freezeForm);
  const membershipErrors = validateMembershipForm(membershipForm);
  const [editingPackage, setEditingPackage] = useState(null);
  const [editingPackageErrors, setEditingPackageErrors] = useState({});
  const [packageSearch, setPackageSearch] = useState("");
  const [packageStatusFilters, setPackageStatusFilters] = useState([]);
  const [packageDurationFilters, setPackageDurationFilters] = useState([]);
  const [packageEntitlementFilters, setPackageEntitlementFilters] = useState([]);
  const [isPackageFilterOpen, setIsPackageFilterOpen] = useState(false);
  const [packageSort, setPackageSort] = useState({ key: "tierRank", direction: "asc" });
  const selectedPackage = packages.find(
    (item) => item.id === membershipForm.packageId,
  );
  const selectedMembershipMember = members.find(
    (item) => item.id === membershipForm.memberId,
  );
  const membershipExpiresOn = estimatedExpiry(
    membershipForm.startsOn,
    selectedPackage?.durationDays,
  );
  const visiblePackages = useMemo(() => {
    const query = packageSearch.trim().toLocaleLowerCase("vi");
    const filtered = packages.filter((item) => {
      const matchesQuery = !query || [item.name, item.code].some((value) => value?.toLocaleLowerCase("vi").includes(query));
      const matchesStatus = !packageStatusFilters.length || packageStatusFilters.includes(item.isActive ? "active" : "inactive");
      const matchesDuration = !packageDurationFilters.length || packageDurationFilters.includes(String(item.durationDays));
      const matchesEntitlement = !packageEntitlementFilters.length || item.entitlements.some((entry) => packageEntitlementFilters.includes(entry.entitlement));
      return matchesQuery && matchesStatus && matchesDuration && matchesEntitlement;
    });
    return sortTable(filtered, packageSort.key, packageSort.direction, (item, key) => item[key]);
  }, [packageDurationFilters, packageEntitlementFilters, packageSearch, packageSort, packageStatusFilters, packages]);
  const packagesPagination = usePagination(visiblePackages);
  const packageDurations = useMemo(
    () => [...new Set(packages.map((item) => String(item.durationDays)))].sort((first, second) => Number(first) - Number(second)),
    [packages],
  );
  function toggleFilterValue(setter, value) {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }
  function togglePackageSort(key) {
    setPackageSort((value) => ({ key, direction: value.key === key && value.direction === "asc" ? "desc" : "asc" }));
  }
  const feedback = useMutationFeedback();
  const submitting = createPackageMutation.isPending || updatePackageMutation.isPending || createMembershipMutation.isPending || requestFreezeMutation.isPending || reviewFreezeMutation.isPending || cancelPendingRenewalMutation.isPending;
  const setError = feedback.setError;
  const setNotice = feedback.setNotice;
  const { error, notice } = feedback;
  function changePackageField(field, value) {
    const next = { ...packageForm, [field]: value };
    setPackageForm(next);
    setPackageFormErrors((current) => ({ ...current, [field]: validatePackageForm(next).errors?.[field] }));
  }
  function changeEditingPackageField(field, value) {
    const next = { ...editingPackage, [field]: value };
    setEditingPackage(next);
    setEditingPackageErrors((current) => ({ ...current, [field]: validatePackageForm(next).errors?.[field] }));
  }
  function changeFreezeField(field, value) {
    setFreezeTouched((current) => ({ ...current, [field]: true }));
    setFreezeForm((current) => ({ ...current, [field]: value }));
  }
  function changeMembershipField(field, value) {
    setMembershipTouched((current) => ({ ...current, [field]: true }));
    setMembershipForm((current) => ({ ...current, [field]: value }));
  }
  async function createPackage(event) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setNotice("");
    setPackageFormErrors({});
    const validation = validatePackageForm(packageForm);
    if (validation.errors) {
      setPackageFormErrors(validation.errors);
      setError(Object.values(validation.errors).join(" "));
      return;
    }
    try {
      await createPackageMutation.mutateAsync(validation.input);
      setPackageForm(emptyPackage);
      setNotice("Đã tạo gói tập.");
      await load();
    } catch (caught) {
      setPackageFormErrors((current) => ({ ...current, ...fieldErrorsFor(caught) }));
      setError(errorMessageFor(caught, "Không thể tạo gói tập."));
    }
  }
  function toggleEntitlement(code) {
    setPackageForm((value) => ({
      ...value,
      entitlements: value.entitlements.includes(code)
        ? value.entitlements.filter((item) => item !== code)
        : [...value.entitlements, code],
    }));
  }
  function toggleEditingEntitlement(code) {
    setEditingPackage((value) => ({
      ...value,
      entitlements: value.entitlements.includes(code)
        ? value.entitlements.filter((item) => item !== code)
        : [...value.entitlements, code],
    }));
  }
  function openPackageEditor(item) {
    setEditingPackageErrors({});
    setEditingPackage({
      id: item.id,
      name: item.name,
      priceVnd: String(item.priceVnd),
      durationDays: String(item.durationDays),
      tierRank: String(item.tierRank),
      benefits: item.benefits.join("\n"),
      entitlements: item.entitlements.map((entry) => entry.entitlement),
      isActive: item.isActive,
    });
  }
  async function updatePackage(event) {
    event.preventDefault(); if (submitting) return;
    if (!editingPackage) return;
    setError("");
    setNotice("");
    setEditingPackageErrors({});
    const validation = validatePackageForm(editingPackage);
    if (validation.errors) {
      setEditingPackageErrors(validation.errors);
      setError(Object.values(validation.errors).join(" "));
      return;
    }
    try {
      const { id, ...input } = validation.input;
      await updatePackageMutation.mutateAsync({ id, input });
      setEditingPackage(null);
      setNotice("Đã cập nhật gói tập và quyền sử dụng.");
      await load();
    } catch (caught) {
      setEditingPackageErrors((current) => ({ ...current, ...fieldErrorsFor(caught) }));
      setError(errorMessageFor(caught, "Không thể cập nhật gói tập."));
    }
  }
  async function createMembership(event) {
    event.preventDefault(); if (submitting) return;
    setMembershipTouched({ memberId: true, packageId: true, startsOn: true });
    if (Object.keys(membershipErrors).length) { setError(Object.values(membershipErrors).join(" ")); return; }
    setError("");
    setNotice("");
    try {
      const createdMembership = await createMembershipMutation.mutateAsync({ memberId: membershipForm.memberId, input: {
        packageId: membershipForm.packageId,
        startsOn: membershipForm.startsOn,
      } });
      setMembershipForm(emptyMembership);
      setMembershipTouched({});
      setNotice(createdMembership.status === "active"
        ? "Đã kích hoạt gói miễn phí. Không cần lập phiếu thanh toán."
        : "Đã tạo gói chờ thanh toán. Hãy chuyển sang Thanh toán để ghi nhận giao dịch.");
    } catch (caught) {
      setError(errorMessageFor(caught, "Không thể tạo gói cho hội viên."));
    }
  }
  async function requestFreeze(event) {
    event.preventDefault(); if (submitting) return;
    setFreezeTouched({ membershipId: true, startsOn: true, endsOn: true, reason: true });
    if (Object.keys(freezeErrors).length) { setError(Object.values(freezeErrors).join(" ")); return; }
    setError("");
    setNotice("");
    try {
      await requestFreezeMutation.mutateAsync({ id: freezeForm.membershipId, input: {
        startsOn: freezeForm.startsOn,
        endsOn: freezeForm.endsOn,
        reason: freezeForm.reason,
      } });
      setFreezeForm(emptyFreeze);
      setFreezeTouched({});
      setNotice("Đã gửi yêu cầu đóng băng để Lễ tân duyệt.");
      await load();
    } catch (caught) {
      setError(errorMessageFor(caught, "Không thể gửi yêu cầu đóng băng."));
    }
  }
  async function reviewFreeze(id, approved) {
    setError("");
    setNotice("");
    try {
      await reviewFreezeMutation.mutateAsync({ id, approved });
      setNotice(
        approved
          ? "Đã duyệt đóng băng và cộng bù thời hạn gói."
          : "Đã từ chối yêu cầu đóng băng.",
      );
      await load();
    } catch (caught) {
      setError(errorMessageFor(caught, "Không thể xử lý yêu cầu đóng băng."));
    }
  }
  async function loadMemberMemberships(memberId) {
    setSelectedMemberId(memberId);
    if (!memberId) return;
    setError("");
  }
  async function cancelPendingRenewal(id) {
    setError("");
    setNotice("");
    try {
      await cancelPendingRenewalMutation.mutateAsync(id);
      setNotice(
        "Đã hủy yêu cầu gia hạn chờ thanh toán. Gói đang thanh toán vẫn giữ nguyên.",
      );
      await load();
    } catch (caught) {
      setError(errorMessageFor(caught, "Không thể hủy yêu cầu gia hạn."));
    }
  }

  if (isMember)
    return (
      <main className="members-page">
        <header>
          <p>Gói tập</p>
          <h1>Gói tập của tôi</h1>
        </header>
        {(error || queryError) && (
          <p className="auth-alert" role="alert">
            {error || queryError}
          </p>
        )}
        {notice && (
          <p className="auth-success" role="status">
            {notice}
          </p>
        )}
        <section className="members-grid">
          <form className="members-form" onSubmit={requestFreeze} noValidate>
            <h2>Yêu cầu đóng băng</h2>
            <label>
              Gói tập
              <select
                aria-invalid={Boolean(freezeTouched.membershipId && freezeErrors.membershipId)}
                className={freezeTouched.membershipId && freezeErrors.membershipId ? "input-error" : ""}
                onChange={(event) => changeFreezeField("membershipId", event.target.value)}
                required
                value={freezeForm.membershipId}
              >
                <option value="">Chọn gói đang hoạt động</option>
                {memberships
                  .filter((item) => item.status === "active")
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.package_name_snapshot} — hết hạn{" "}
                      {new Date(item.expires_on).toLocaleDateString("vi-VN")}
                    </option>
                  ))}
              </select>
              {freezeTouched.membershipId && freezeErrors.membershipId && <span className="field-error">{freezeErrors.membershipId}</span>}
            </label>
            <label>
              Ngày bắt đầu
              <input
                aria-invalid={Boolean(freezeTouched.startsOn && freezeErrors.startsOn)}
                className={freezeTouched.startsOn && freezeErrors.startsOn ? "input-error" : ""}
                onChange={(event) => changeFreezeField("startsOn", event.target.value)}
                required
                type="date"
                value={freezeForm.startsOn}
              />
              {freezeTouched.startsOn && freezeErrors.startsOn && <span className="field-error">{freezeErrors.startsOn}</span>}
            </label>
            <label>
              Ngày kết thúc
              <input
                aria-invalid={Boolean(freezeTouched.endsOn && freezeErrors.endsOn)}
                className={freezeTouched.endsOn && freezeErrors.endsOn ? "input-error" : ""}
                onChange={(event) => changeFreezeField("endsOn", event.target.value)}
                required
                type="date"
                value={freezeForm.endsOn}
              />
              {freezeTouched.endsOn && freezeErrors.endsOn && <span className="field-error">{freezeErrors.endsOn}</span>}
            </label>
            <label>
              Lý do
              <textarea
                aria-invalid={Boolean(freezeTouched.reason && freezeErrors.reason)}
                className={freezeTouched.reason && freezeErrors.reason ? "input-error" : ""}
                minLength="3"
                onChange={(event) => changeFreezeField("reason", event.target.value)}
                required
                value={freezeForm.reason}
              />
              {freezeTouched.reason && freezeErrors.reason && <span className="field-error">{freezeErrors.reason}</span>}
            </label>
            <Button loading={submitting} type="submit">
              Gửi yêu cầu
            </Button>
          </form>
          <MembershipList items={memberships} loading={loading} />
        </section>
      </main>
    );

  return (
    <main className={`members-page${isManager ? " packages-page" : ""}`}>
      <header>
        <p>Gói tập</p>
        <h1>
          {isManager ? (mode === "create" ? "Tạo gói tập" : mode === "catalog" ? "Danh mục gói" : mode === "assign" ? "Gói tập hội viên" : "Cấu hình gói tập") : "Quản lý gói tập hội viên"}
        </h1>
      </header>
      {(error || queryError) && (
        <p className="auth-alert" role="alert">
          {error || queryError}
        </p>
      )}
      {notice && (
        <p className="auth-success" role="status">
          {notice}
        </p>
      )}
      <section
        aria-label={isManager ? "Gói tập" : undefined}
        className={`members-grid membership-workspace${isManager ? (showManagerCreate && showManagerCatalog ? " membership-workspace--manager" : mode === "catalog" ? " membership-workspace--catalog" : " membership-workspace--single") : " membership-workspace--assignment-only"}${showAssignment ? " membership-workspace--assignment" : ""}${packagePageLayout}`}
      >
        {showManagerCreate && (
          <form className="members-form package-create-form" onSubmit={createPackage} noValidate>
            <h2>Tạo gói tập</h2>
            <label className="package-create-form__identity">
              Mã gói
              <input
                list="package-code-options"
                className={packageFormErrors.code ? "input-error" : ""}
                onChange={(event) => changePackageField("code", event.target.value.toUpperCase())}
                placeholder="Ví dụ: STANDARD"
                pattern="[A-Z0-9_-]{2,30}"
                required
                title="Mã gói gồm 2–30 ký tự in hoa, số, dấu gạch dưới hoặc gạch ngang."
                value={packageForm.code}
              />
              {packageFormErrors.code && <span className="field-error">{packageFormErrors.code}</span>}
              <datalist id="package-code-options">
                {packageTemplates.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="package-create-form__identity">
              Tên gói
              <input
                list="package-name-options"
                className={packageFormErrors.name ? "input-error" : ""}
                onChange={(event) => changePackageField("name", event.target.value)}
                placeholder="Ví dụ: Gói Tiêu chuẩn"
                required
                minLength={2}
                maxLength={100}
                value={packageForm.name}
              />
              {packageFormErrors.name && <span className="field-error">{packageFormErrors.name}</span>}
              <datalist id="package-name-options">
                {packageTemplates.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.code}
                  </option>
                ))}
              </datalist>
            </label>
            {[
              ["priceVnd", "Giá (VNĐ)", 0, undefined],
              ["durationDays", "Số ngày", 1, 730],
              ["tierRank", "Thứ hạng quyền", 1, undefined],
            ].map(([key, label]) => (
              <label className="package-create-form__metric" key={key}>
                {label}
                <input
                  className={packageFormErrors[key] ? "input-error" : ""}
                  min={key === "priceVnd" ? 0 : 1}
                  max={key === "durationDays" ? 730 : undefined}
                  onChange={(event) => changePackageField(key, event.target.value)}
                  required
                  step="1"
                  type="number"
                  value={packageForm[key]}
                />
                {packageFormErrors[key] && <span className="field-error">{packageFormErrors[key]}</span>}
              </label>
            ))}
            <fieldset className="entitlement-fieldset">
              <legend>Quyền sử dụng</legend>
              <p>Gói hạng cao kế thừa quyền sử dụng của các gói hạng thấp hơn. Các ô bên dưới là quyền thêm riêng cho gói này.</p>
              {Object.entries(entitlementLabels).map(([code, label]) => (
                <label key={code}>
                  <input
                    checked={packageForm.entitlements.includes(code)}
                    onChange={() => toggleEntitlement(code)}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              Quyền hiển thị (mỗi dòng một quyền)
              <textarea
                onChange={(event) =>
                  setPackageForm({
                    ...packageForm,
                    benefits: event.target.value,
                  })
                }
                value={packageForm.benefits}
              />
            </label>
            <Button loading={submitting} type="submit">
              Tạo gói
            </Button>
          </form>
        )}
        {showAssignment && (
        <form className="members-form" onSubmit={createMembership} noValidate>
          <h2>Tạo gói cho hội viên</h2>
          <label>
            Hội viên
            <select
              aria-invalid={Boolean(membershipTouched.memberId && membershipErrors.memberId)}
              className={membershipTouched.memberId && membershipErrors.memberId ? "input-error" : ""}
              onChange={(event) => changeMembershipField("memberId", event.target.value)}
              required
              value={membershipForm.memberId}
            >
              <option value="">Chọn hội viên</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} — {member.memberCode}
                </option>
              ))}
            </select>
            {membershipTouched.memberId && membershipErrors.memberId && <span className="field-error">{membershipErrors.memberId}</span>}
          </label>
          <section className="selected-member-summary" aria-live="polite">
            <div>
              <span>Thông tin hội viên</span>
              <strong>{selectedMembershipMember?.fullName || "—"}</strong>
            </div>
            <dl>
              <div>
                <dt>Mã hội viên</dt>
                <dd>{selectedMembershipMember?.memberCode || "—"}</dd>
              </div>
              <div>
                <dt>Số điện thoại</dt>
                <dd>{selectedMembershipMember?.phone || "—"}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selectedMembershipMember?.email || "—"}</dd>
              </div>
            </dl>
          </section>
          <label>
            Gói tập
            <select
              aria-invalid={Boolean(membershipTouched.packageId && membershipErrors.packageId)}
              className={membershipTouched.packageId && membershipErrors.packageId ? "input-error" : ""}
              onChange={(event) => changeMembershipField("packageId", event.target.value)}
              required
              value={membershipForm.packageId}
            >
              <option value="">Chọn gói</option>
              {packages
                .filter((item) => item.isActive)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} —{" "}
                    {Number(item.priceVnd).toLocaleString("vi-VN")} ₫
                  </option>
                ))}
            </select>
            {membershipTouched.packageId && membershipErrors.packageId && <span className="field-error">{membershipErrors.packageId}</span>}
          </label>
          <section className="selected-member-summary" aria-live="polite">
            <div>
              <span>Thông tin gói tập</span>
              <strong>{selectedPackage?.name || "—"}</strong>
            </div>
            <dl>
              <div>
                <dt>Mã gói · Hạng</dt>
                <dd>{selectedPackage ? `${selectedPackage.code} · Hạng ${selectedPackage.tierRank}` : "—"}</dd>
              </div>
              <div>
                <dt>Giá</dt>
                <dd>{selectedPackage ? `${Number(selectedPackage.priceVnd).toLocaleString("vi-VN")} ₫` : "—"}</dd>
              </div>
              <div>
                <dt>Thời hạn</dt>
                <dd>{selectedPackage ? `${selectedPackage.durationDays} ngày` : "—"}</dd>
              </div>
            </dl>
          </section>
          <label>
            Ngày bắt đầu dự kiến
            <input
              aria-invalid={Boolean(membershipTouched.startsOn && membershipErrors.startsOn)}
              className={membershipTouched.startsOn && membershipErrors.startsOn ? "input-error" : ""}
              onChange={(event) => changeMembershipField("startsOn", event.target.value)}
              required
              type="date"
              value={membershipForm.startsOn}
            />
            {membershipTouched.startsOn && membershipErrors.startsOn && <span className="field-error">{membershipErrors.startsOn}</span>}
          </label>
          <label>
            Ngày hết hạn dự kiến
            <input disabled type="date" value={membershipExpiresOn} />
          </label>
          <Button loading={submitting} type="submit">
            Tạo gói cho hội viên
          </Button>
        </form>
        )}
        {(showAssignment || (isManager && canReviewFreeze && mode !== "create")) && (
          <aside className="membership-assignment-sidebar">
            {showAssignment && <MemberMembershipOverview
              items={memberships}
              loading={loading}
              members={members}
              onCancel={cancelPendingRenewal}
              onMemberChange={loadMemberMemberships}
              selectedMemberId={selectedMemberId}
              submitting={submitting}
            />}
            <FreezeRequestReview
              canReview={canReviewFreeze}
              items={freezeRequests}
              onReview={reviewFreeze}
              submitting={submitting}
            />
          </aside>
        )}
      {(isReceptionist || showManagerCatalog) && (
      <section className="members-list package-catalog-list">
        <div className="list-heading">
          <h2>Danh mục gói</h2>
          <Button onClick={load} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        {loading ? (
          <TableSkeleton columns={6} />
        ) : (
          <>
            <DataTableToolbar
              onClear={() => { setPackageSearch(""); setPackageStatusFilters([]); setPackageDurationFilters([]); setPackageEntitlementFilters([]); }}
              resultCount={visiblePackages.length}
              search={packageSearch}
              searchPlaceholder="Tìm tên hoặc mã gói..."
              setSearch={setPackageSearch}
            >
              <FilterMenu activeCount={packageStatusFilters.length + packageDurationFilters.length + packageEntitlementFilters.length} className="filter-menu--package" isOpen={isPackageFilterOpen} onToggle={() => setIsPackageFilterOpen((value) => !value)}>
                <fieldset className="payment-filter-group">
                  <legend>Trạng thái</legend>
                  {[["active", "Đang dùng"], ["inactive", "Ngừng dùng"]].map(([value, label]) => (
                    <label key={value}>
                      <input checked={packageStatusFilters.includes(value)} onChange={() => toggleFilterValue(setPackageStatusFilters, value)} type="checkbox" />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <fieldset className="payment-filter-group">
                  <legend>Thời hạn</legend>
                  {packageDurations.length ? packageDurations.map((duration) => (
                    <label key={duration}>
                      <input checked={packageDurationFilters.includes(duration)} onChange={() => toggleFilterValue(setPackageDurationFilters, duration)} type="checkbox" />
                      {duration} ngày
                    </label>
                  )) : <p>Chưa có thời hạn gói để lọc.</p>}
                </fieldset>
                <fieldset className="payment-filter-group">
                  <legend>Quyền sử dụng</legend>
                  {Object.entries(entitlementLabels).map(([code, label]) => (
                    <label key={code}>
                      <input checked={packageEntitlementFilters.includes(code)} onChange={() => toggleFilterValue(setPackageEntitlementFilters, code)} type="checkbox" />
                      {label}
                    </label>
                  ))}
                </fieldset>
              </FilterMenu>
            </DataTableToolbar>
            {visiblePackages.length === 0 ? <p>Không có gói phù hợp với bộ lọc.</p> : <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Mã gói</th>
                  <SortableHeader activeSort={packageSort.key} column="name" direction={packageSort.direction} onSort={togglePackageSort}>Tên gói</SortableHeader>
                  <SortableHeader activeSort={packageSort.key} column="durationDays" direction={packageSort.direction} onSort={togglePackageSort}>Thời hạn gói</SortableHeader>
                  <SortableHeader activeSort={packageSort.key} column="priceVnd" direction={packageSort.direction} onSort={togglePackageSort}>Giá gói</SortableHeader>
                  <th>Quyền sử dụng</th>
                  {canCreatePackages && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {packagesPagination.pageItems.map((item) => (
                  <tr key={item.id}>
                    <td><code>{item.code}</code></td>
                    <td>
                      <strong>{item.name}</strong>
                      <small>
                        Hạng {item.tierRank}
                      </small>
                    </td>
                    <td>{item.durationDays} ngày</td>
                    <td>{Number(item.priceVnd).toLocaleString("vi-VN")} ₫</td>
                    <td className="package-entitlements-cell">
                      {item.entitlements.length ? (
                        <ul className="package-entitlements">
                          {item.entitlements.map((entry) => (
                            <li key={entry.entitlement}>
                              {entitlementLabel(entry.entitlement)}
                            </li>
                          ))}
                        </ul>
                      ) : item.benefits.length ? (
                        <span className="package-benefits">
                          {item.benefits.join(", ")}
                        </span>
                      ) : (
                        "Chưa cấu hình"
                      )}
                    </td>
                    {canCreatePackages && <td>
                        <Button
                          onClick={() => openPackageEditor(item)}
                          size="sm"
                          variant="primary"
                        >
                          Sửa
                        </Button>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
          <Pagination {...packagesPagination} />
          </>
        )}
      </section>
      )}
      </section>
      <Dialog
        isOpen={Boolean(editingPackage)}
        onClose={() => setEditingPackage(null)}
        title="Cập nhật gói tập"
      >
        {editingPackage && (
          <form className="members-form dialog-scrollable-form" onSubmit={updatePackage} noValidate>
            <div className="dialog-scrollable-content">
            <label>
              Tên gói
              <input
                className={editingPackageErrors.name ? "input-error" : ""}
                onChange={(event) => changeEditingPackageField("name", event.target.value)}
                required
                value={editingPackage.name}
              />
              {editingPackageErrors.name && <span className="field-error">{editingPackageErrors.name}</span>}
            </label>
            <label>
              Giá (VNĐ)
              <input
                min="0"
                className={editingPackageErrors.priceVnd ? "input-error" : ""}
                onChange={(event) => changeEditingPackageField("priceVnd", event.target.value)}
                required
                type="number"
                value={editingPackage.priceVnd}
              />
              {editingPackageErrors.priceVnd && <span className="field-error">{editingPackageErrors.priceVnd}</span>}
            </label>
            <label>
              Số ngày
              <input
                min="1"
                className={editingPackageErrors.durationDays ? "input-error" : ""}
                onChange={(event) => changeEditingPackageField("durationDays", event.target.value)}
                required
                type="number"
                value={editingPackage.durationDays}
              />
              {editingPackageErrors.durationDays && <span className="field-error">{editingPackageErrors.durationDays}</span>}
            </label>
            <label>
              Thứ hạng quyền
              <input
                min="1"
                className={editingPackageErrors.tierRank ? "input-error" : ""}
                onChange={(event) => changeEditingPackageField("tierRank", event.target.value)}
                required
                type="number"
                value={editingPackage.tierRank}
              />
              {editingPackageErrors.tierRank && <span className="field-error">{editingPackageErrors.tierRank}</span>}
            </label>
            <fieldset className="entitlement-fieldset">
              <legend>Quyền sử dụng</legend>
              <p>Gói hạng cao kế thừa quyền sử dụng của các gói hạng thấp hơn. Các ô bên dưới là quyền thêm riêng cho gói này.</p>
              {Object.entries(entitlementLabels).map(([code, label]) => (
                <label key={code}>
                  <input
                    checked={editingPackage.entitlements.includes(code)}
                    onChange={() => toggleEditingEntitlement(code)}
                    type="checkbox"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label>
              Quyền hiển thị (mỗi dòng một quyền)
              <textarea
                onChange={(event) =>
                  setEditingPackage({
                    ...editingPackage,
                    benefits: event.target.value,
                  })
                }
                value={editingPackage.benefits}
              />
            </label>
            <label>
              <input
                checked={editingPackage.isActive}
                onChange={(event) =>
                  setEditingPackage({
                    ...editingPackage,
                    isActive: event.target.checked,
                  })
                }
                type="checkbox"
              />{" "}
              Gói đang khả dụng
            </label>
            </div>
            <div className="dialog-sticky-footer">
              <Button loading={submitting} type="submit">
                Lưu gói tập
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </main>
  );
}

function MembershipList({ embedded = false, items, loading, onCancel, submitting }) {
  const membershipPagination = usePagination(items);
  const content = (
    <>
      {embedded ? <h3>Gói đã đăng ký</h3> : <h2>Gói đã đăng ký</h2>}
      {loading ? (
        <TableSkeleton columns={5} />
      ) : items.length === 0 ? (
        <p>Chưa có gói tập.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã đăng ký</th>
                <th>Tên gói</th>
                <th>Hiệu lực</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {membershipPagination.pageItems.map((item) => (
                <tr key={item.id}>
                  <td><code>{item.id}</code></td>
                  <td>
                    <strong>{item.package_name_snapshot}</strong>
                    <small>
                      {Number(item.priceVnd).toLocaleString("vi-VN")} ₫
                    </small>
                  </td>
                  <td>
                    {new Date(item.starts_on).toLocaleDateString("vi-VN")} –{" "}
                    {new Date(item.expires_on).toLocaleDateString("vi-VN")}
                  </td>
                  <td>
                    <strong>{membershipStatus[item.status] ?? item.status}</strong>
                    {membershipGraceLabel(item) && <small>{membershipGraceLabel(item)}</small>}
                  </td>
                  <td>
                    {onCancel && item.status === "pending_payment" && (
                      <Button
                        disabled={submitting}
                        onClick={() => onCancel(item.id)}
                        size="sm"
                        variant="danger"
                      >
                        Hủy yêu cầu
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination {...membershipPagination} />
    </>
  );
  return embedded ? (
    <div className="membership-list-content">{content}</div>
  ) : (
    <section className="members-list">{content}</section>
  );
}

function MemberMembershipOverview({
  items,
  loading,
  members,
  onCancel,
  onMemberChange,
  selectedMemberId,
  submitting,
}) {
  return (
    <section className="members-list membership-member-overview">
      <h2>Gói tập theo hội viên</h2>
      <label className="field-inline">
        Hội viên
        <select
          onChange={(event) => void onMemberChange(event.target.value)}
          value={selectedMemberId}
        >
          <option value="">Chọn hội viên để xem gói</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.fullName} — {member.memberCode}
            </option>
          ))}
        </select>
      </label>
      {selectedMemberId && (
        <MembershipList
          embedded
          items={items}
          loading={loading}
          onCancel={onCancel}
          submitting={submitting}
        />
      )}
    </section>
  );
}

function FreezeRequestReview({ canReview, items, onReview, submitting }) {
  const freezePagination = usePagination(items);
  if (!canReview) return null;

  return (
    <section className="members-list membership-freeze-review">
      <h2>Yêu cầu đóng băng chờ duyệt</h2>
      {items.length === 0 ? (
        <p>Không có yêu cầu chờ duyệt.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã yêu cầu</th>
                <th>Hội viên yêu cầu</th>
                <th>Gói áp dụng</th>
                <th>Thời gian</th>
                <th>Lý do</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {freezePagination.pageItems.map((item) => (
                <tr key={item.id}>
                  <td><code>{item.id}</code></td>
                  <td>
                    {item.member?.full_name ?? "Hội viên"}
                    <small>{item.member?.member_code}</small>
                  </td>
                  <td>{item.membership?.package_name_snapshot}</td>
                  <td>
                    {new Date(item.starts_on).toLocaleDateString("vi-VN")} –{" "}
                    {new Date(item.ends_on).toLocaleDateString("vi-VN")}
                  </td>
                  <td>{item.reason}</td>
                  <td>
                    <Button
                      disabled={submitting}
                      onClick={() => onReview(item.id, true)}
                      size="sm"
                    >
                      Duyệt
                    </Button>{" "}
                    <Button
                      disabled={submitting}
                      onClick={() => onReview(item.id, false)}
                      size="sm"
                      variant="danger"
                    >
                      Từ chối
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination {...freezePagination} />
    </section>
  );
}
