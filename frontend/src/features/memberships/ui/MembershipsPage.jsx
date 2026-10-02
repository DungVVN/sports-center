import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { MembershipList } from "./MembershipList.jsx";
import { MemberMembershipOverview } from "./MemberMembershipOverview.jsx";
import { FreezeRequestReview } from "./FreezeRequestReview.jsx";
import {
  emptyPackage,
  emptyFreeze,
  emptyMembership,
  estimatedExpiry,
  validatePackageForm,
  validateMembershipForm,
  validateFreezeForm,
} from "../domain/membership-form.js";
import { MembershipFreezeForm } from "./MembershipFreezeForm.jsx";
import { PackageCreateForm } from "./PackageCreateForm.jsx";
import { MembershipAssignmentForm } from "./MembershipAssignmentForm.jsx";
import { PackageCatalog } from "./PackageCatalog.jsx";
import { PackageEditDialog } from "./PackageEditDialog.jsx";
import { useState } from "react";
import { hasSessionPermission } from "../../auth/index.js";
import { useMutationFeedback } from "../../../shared/lib/useMutationFeedback.js";
import {
  errorMessageFor,
  fieldErrorsFor,
} from "../../../shared/api/error-message.js";
import { useMembershipWorkspace } from "../api/useMembershipWorkspace.js";
import "./membership-layout.css";
export function MembershipsPage({ mode = "workspace", session }) {
  const role = session?.user?.role;
  const isMember = role === "member" && mode === "workspace";
  const canCreatePackages = hasSessionPermission(
    session,
    "membership.package.manage",
  );
  const isManager =
    canCreatePackages ||
    (mode === "catalog" &&
      hasSessionPermission(session, "membership.package.read"));
  const isReceptionist =
    !isManager && hasSessionPermission(session, "membership.assign");
  const canAssignMembership = hasSessionPermission(
    session,
    "membership.assign",
  );
  const canReviewFreeze = hasSessionPermission(
    session,
    "membership.freeze.review",
  );
  const showManagerCreate =
    canCreatePackages && ["workspace", "create"].includes(mode);
  const showManagerCatalog =
    isManager && ["workspace", "catalog"].includes(mode);
  const showAssignment =
    canAssignMembership && (!isManager || mode === "assign");
  const packagePageLayout =
    isManager && mode === "create"
      ? " package-page-layout package-page-layout--create"
      : isManager && mode === "catalog"
        ? " package-page-layout package-page-layout--catalog"
        : "";
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
  const feedback = useMutationFeedback();
  const submitting =
    createPackageMutation.isPending ||
    updatePackageMutation.isPending ||
    createMembershipMutation.isPending ||
    requestFreezeMutation.isPending ||
    reviewFreezeMutation.isPending ||
    cancelPendingRenewalMutation.isPending;
  const setError = feedback.setError;
  const setNotice = feedback.setNotice;
  const { error, notice } = feedback;
  function changePackageField(field, value) {
    const next = {
      ...packageForm,
      [field]: value,
    };
    setPackageForm(next);
    setPackageFormErrors((current) => ({
      ...current,
      [field]: validatePackageForm(next).errors?.[field],
    }));
  }
  function changeEditingPackageField(field, value) {
    const next = {
      ...editingPackage,
      [field]: value,
    };
    setEditingPackage(next);
    setEditingPackageErrors((current) => ({
      ...current,
      [field]: validatePackageForm(next).errors?.[field],
    }));
  }
  function changeFreezeField(field, value) {
    setFreezeTouched((current) => ({
      ...current,
      [field]: true,
    }));
    setFreezeForm((current) => ({
      ...current,
      [field]: value,
    }));
  }
  function changeMembershipField(field, value) {
    setMembershipTouched((current) => ({
      ...current,
      [field]: true,
    }));
    setMembershipForm((current) => ({
      ...current,
      [field]: value,
    }));
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
      setPackageFormErrors((current) => ({
        ...current,
        ...fieldErrorsFor(caught),
      }));
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
    event.preventDefault();
    if (submitting) return;
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
      await updatePackageMutation.mutateAsync({
        id,
        input,
      });
      setEditingPackage(null);
      setNotice("Đã cập nhật gói tập và quyền sử dụng.");
      await load();
    } catch (caught) {
      setEditingPackageErrors((current) => ({
        ...current,
        ...fieldErrorsFor(caught),
      }));
      setError(errorMessageFor(caught, "Không thể cập nhật gói tập."));
    }
  }
  async function createMembership(event) {
    event.preventDefault();
    if (submitting) return;
    setMembershipTouched({
      memberId: true,
      packageId: true,
      startsOn: true,
    });
    if (Object.keys(membershipErrors).length) {
      setError(Object.values(membershipErrors).join(" "));
      return;
    }
    setError("");
    setNotice("");
    try {
      const createdMembership = await createMembershipMutation.mutateAsync({
        memberId: membershipForm.memberId,
        input: {
          packageId: membershipForm.packageId,
          startsOn: membershipForm.startsOn,
        },
      });
      setMembershipForm(emptyMembership);
      setMembershipTouched({});
      setNotice(
        createdMembership.status === "active"
          ? "Đã kích hoạt gói miễn phí. Không cần lập phiếu thanh toán."
          : "Đã tạo gói chờ thanh toán. Hãy chuyển sang Thanh toán để ghi nhận giao dịch.",
      );
    } catch (caught) {
      setError(errorMessageFor(caught, "Không thể tạo gói cho hội viên."));
    }
  }
  async function requestFreeze(event) {
    event.preventDefault();
    if (submitting) return;
    setFreezeTouched({
      membershipId: true,
      startsOn: true,
      endsOn: true,
      reason: true,
    });
    if (Object.keys(freezeErrors).length) {
      setError(Object.values(freezeErrors).join(" "));
      return;
    }
    setError("");
    setNotice("");
    try {
      await requestFreezeMutation.mutateAsync({
        id: freezeForm.membershipId,
        input: {
          startsOn: freezeForm.startsOn,
          endsOn: freezeForm.endsOn,
          reason: freezeForm.reason,
        },
      });
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
      await reviewFreezeMutation.mutateAsync({
        id,
        approved,
      });
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
        <PageHeader eyebrow="Gói tập" title="Gói tập của tôi" />
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
          <MembershipFreezeForm
            changeFreezeField={changeFreezeField}
            freezeErrors={freezeErrors}
            freezeForm={freezeForm}
            freezeTouched={freezeTouched}
            memberships={memberships}
            requestFreeze={requestFreeze}
            submitting={submitting}
          />
          <MembershipList items={memberships} loading={loading} />
        </section>
      </main>
    );
  return (
    <main className={`members-page${isManager ? " packages-page" : ""}`}>
      <PageHeader eyebrow="Gói tập" title={isManager
            ? mode === "create"
              ? "Tạo gói tập"
              : mode === "catalog"
                ? "Danh mục gói"
                : mode === "assign"
                  ? "Gói tập hội viên"
                  : "Cấu hình gói tập"
            : "Quản lý gói tập hội viên"} />
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
          <PackageCreateForm
            changePackageField={changePackageField}
            createPackage={createPackage}
            packageForm={packageForm}
            packageFormErrors={packageFormErrors}
            setPackageForm={setPackageForm}
            submitting={submitting}
            toggleEntitlement={toggleEntitlement}
          />
        )}
        {showAssignment && (
          <MembershipAssignmentForm
            changeMembershipField={changeMembershipField}
            createMembership={createMembership}
            members={members}
            membershipErrors={membershipErrors}
            membershipExpiresOn={membershipExpiresOn}
            membershipForm={membershipForm}
            membershipTouched={membershipTouched}
            packages={packages}
            selectedMembershipMember={selectedMembershipMember}
            selectedPackage={selectedPackage}
            submitting={submitting}
          />
        )}
        {(showAssignment ||
          (isManager && canReviewFreeze && mode !== "create")) && (
          <aside className="membership-assignment-sidebar">
            {showAssignment && (
              <MemberMembershipOverview
                items={memberships}
                loading={loading}
                members={members}
                onCancel={cancelPendingRenewal}
                onMemberChange={loadMemberMemberships}
                selectedMemberId={selectedMemberId}
                submitting={submitting}
              />
            )}
            <FreezeRequestReview
              canReview={canReviewFreeze}
              items={freezeRequests}
              onReview={reviewFreeze}
              submitting={submitting}
            />
          </aside>
        )}
        {(isReceptionist || showManagerCatalog) && (
          <PackageCatalog
            canCreatePackages={canCreatePackages}
            load={load}
            loading={loading}
            openPackageEditor={openPackageEditor}
            packages={packages}
          />
        )}
      </section>
      <PackageEditDialog
        changeEditingPackageField={changeEditingPackageField}
        editingPackage={editingPackage}
        editingPackageErrors={editingPackageErrors}
        setEditingPackage={setEditingPackage}
        submitting={submitting}
        toggleEditingEntitlement={toggleEditingEntitlement}
        updatePackage={updatePackage}
      />
    </main>
  );
}
