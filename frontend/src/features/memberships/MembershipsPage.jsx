import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { DataTableToolbar, FilterMenu, SortableHeader } from "../../components/ui/DataTable.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { sortTable } from "../../lib/table.js";
import { memberApi } from "../members/member-api.js";
import { membershipApi } from "./membership-api.js";
import "../members/members.css";
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

export function MembershipsPage({ mode = "workspace", session }) {
  const role = session?.user?.role;
  const isMember = role === "member";
  const isManager = role === "manager";
  const isReceptionist = role === "receptionist";
  const canCreatePackages = isManager;
  const canReviewFreeze = isReceptionist;
  const showManagerCreate = isManager && mode !== "catalog";
  const showManagerCatalog = isManager && mode !== "create";
  const packagePageLayout = isManager && mode === "create" ? " package-page-layout package-page-layout--create" : isManager && mode === "catalog" ? " package-page-layout package-page-layout--catalog" : "";
  const [packages, setPackages] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [freezeRequests, setFreezeRequests] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [packageForm, setPackageForm] = useState(emptyPackage);
  const [freezeForm, setFreezeForm] = useState(emptyFreeze);
  const [membershipForm, setMembershipForm] = useState(emptyMembership);
  const [editingPackage, setEditingPackage] = useState(null);
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
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      if (isMember) setMemberships(await membershipApi.mine());
      else if (isManager) {
        setPackages(await membershipApi.packages());
        setMembers([]);
        setFreezeRequests([]);
      }
      else {
        const base = await Promise.all([
          membershipApi.packages(),
          memberApi.list(),
          canReviewFreeze
            ? membershipApi.freezeRequests()
            : Promise.resolve([]),
        ]);
        setPackages(base[0]);
        setMembers(base[1]);
        setFreezeRequests(base[2]);
      }
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, [canReviewFreeze, isManager, isMember]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function createPackage(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await membershipApi.createPackage({
        ...packageForm,
        priceVnd: Number(packageForm.priceVnd),
        durationDays: Number(packageForm.durationDays),
        tierRank: Number(packageForm.tierRank),
        benefits: packageForm.benefits
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        entitlements: packageForm.entitlements.map((code) => ({ code })),
      });
      setPackageForm(emptyPackage);
      setNotice("Đã tạo gói tập.");
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
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
    if (!editingPackage) return;
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const {
        id,
        benefits,
        entitlements,
        priceVnd,
        durationDays,
        tierRank,
        ...input
      } = editingPackage;
      await membershipApi.updatePackage(id, {
        ...input,
        priceVnd: Number(priceVnd),
        durationDays: Number(durationDays),
        tierRank: Number(tierRank),
        benefits: benefits
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        entitlements: entitlements.map((code) => ({ code })),
      });
      setEditingPackage(null);
      setNotice("Đã cập nhật gói tập và quyền sử dụng.");
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function createMembership(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await membershipApi.create(membershipForm.memberId, {
        packageId: membershipForm.packageId,
        startsOn: membershipForm.startsOn,
      });
      setMembershipForm(emptyMembership);
      setNotice(
        "Đã tạo gói chờ thanh toán. Hãy chuyển sang Thanh toán để ghi nhận giao dịch.",
      );
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function requestFreeze(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await membershipApi.requestFreeze(freezeForm.membershipId, {
        startsOn: freezeForm.startsOn,
        endsOn: freezeForm.endsOn,
        reason: freezeForm.reason,
      });
      setFreezeForm(emptyFreeze);
      setNotice("Đã gửi yêu cầu đóng băng để Lễ tân duyệt.");
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function reviewFreeze(id, approved) {
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await membershipApi.reviewFreeze(id, approved);
      setNotice(
        approved
          ? "Đã duyệt đóng băng và cộng bù thời hạn gói."
          : "Đã từ chối yêu cầu đóng băng.",
      );
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function loadMemberMemberships(memberId) {
    setSelectedMemberId(memberId);
    setMemberships([]);
    if (!memberId) return;
    setError("");
    try {
      setMemberships(await membershipApi.byMember(memberId));
    } catch (caught) {
      setError(caught.message);
    }
  }
  async function cancelPendingRenewal(id) {
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await membershipApi.cancelPendingRenewal(id);
      setNotice(
        "Đã hủy yêu cầu gia hạn chờ thanh toán. Gói đang thanh toán vẫn giữ nguyên.",
      );
      await loadMemberMemberships(selectedMemberId);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (isMember)
    return (
      <main className="members-page">
        <header>
          <p>Gói tập</p>
          <h1>Gói tập của tôi</h1>
        </header>
        {error && (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="auth-success" role="status">
            {notice}
          </p>
        )}
        <section className="members-grid">
          <form className="members-form" onSubmit={requestFreeze}>
            <h2>Yêu cầu đóng băng</h2>
            <label>
              Gói tập
              <select
                onChange={(event) =>
                  setFreezeForm({
                    ...freezeForm,
                    membershipId: event.target.value,
                  })
                }
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
            </label>
            <label>
              Ngày bắt đầu
              <input
                onChange={(event) =>
                  setFreezeForm({ ...freezeForm, startsOn: event.target.value })
                }
                required
                type="date"
                value={freezeForm.startsOn}
              />
            </label>
            <label>
              Ngày kết thúc
              <input
                onChange={(event) =>
                  setFreezeForm({ ...freezeForm, endsOn: event.target.value })
                }
                required
                type="date"
                value={freezeForm.endsOn}
              />
            </label>
            <label>
              Lý do
              <textarea
                minLength="3"
                onChange={(event) =>
                  setFreezeForm({ ...freezeForm, reason: event.target.value })
                }
                required
                value={freezeForm.reason}
              />
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
          {isManager ? (mode === "create" ? "Tạo gói tập" : mode === "catalog" ? "Danh mục gói" : "Cấu hình gói tập") : "Quản lý gói tập hội viên"}
        </h1>
      </header>
      {error && (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="auth-success" role="status">
          {notice}
        </p>
      )}
      <section
        aria-label={isManager ? "Gói tập" : undefined}
        className={`members-grid membership-workspace${isManager ? (showManagerCreate && showManagerCatalog ? " membership-workspace--manager" : mode === "catalog" ? " membership-workspace--catalog" : " membership-workspace--single") : " membership-workspace--assignment-only"}${packagePageLayout}`}
      >
        {showManagerCreate && (
          <form className="members-form package-create-form" onSubmit={createPackage}>
            <h2>Tạo gói tập</h2>
            <label className="package-create-form__identity">
              Mã gói
              <input
                list="package-code-options"
                onChange={(event) =>
                  setPackageForm({ ...packageForm, code: event.target.value })
                }
                placeholder="Ví dụ: STANDARD"
                required
                value={packageForm.code}
              />
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
                onChange={(event) =>
                  setPackageForm({ ...packageForm, name: event.target.value })
                }
                placeholder="Ví dụ: Gói Tiêu chuẩn"
                required
                value={packageForm.name}
              />
              <datalist id="package-name-options">
                {packageTemplates.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.code}
                  </option>
                ))}
              </datalist>
            </label>
            {[
              ["priceVnd", "Giá (VNĐ)"],
              ["durationDays", "Số ngày"],
              ["tierRank", "Thứ hạng quyền"],
            ].map(([key, label]) => (
              <label className="package-create-form__metric" key={key}>
                {label}
                <input
                  onChange={(event) =>
                    setPackageForm({
                      ...packageForm,
                      [key]: event.target.value,
                    })
                  }
                  required
                  value={packageForm[key]}
                />
              </label>
            ))}
            <fieldset className="entitlement-fieldset">
              <legend>Quyền sử dụng</legend>
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
        {isReceptionist && (
        <form className="members-form" onSubmit={createMembership}>
          <h2>Tạo gói cho hội viên</h2>
          <label>
            Hội viên
            <select
              onChange={(event) =>
                setMembershipForm({
                  ...membershipForm,
                  memberId: event.target.value,
                })
              }
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
              onChange={(event) =>
                setMembershipForm({
                  ...membershipForm,
                  packageId: event.target.value,
                })
              }
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
              onChange={(event) =>
                setMembershipForm({
                  ...membershipForm,
                  startsOn: event.target.value,
                })
              }
              required
              type="date"
              value={membershipForm.startsOn}
            />
          </label>
          <label>
            Ngày hết hạn dự kiến
            <input disabled type="date" value={membershipExpiresOn} />
          </label>
          <Button loading={submitting} type="submit">
            Tạo chờ thanh toán
          </Button>
        </form>
        )}
        {isReceptionist && (
          <aside className="membership-assignment-sidebar">
            <MemberMembershipOverview
              items={memberships}
              loading={loading}
              members={members}
              onCancel={cancelPendingRenewal}
              onMemberChange={loadMemberMemberships}
              selectedMemberId={selectedMemberId}
              submitting={submitting}
            />
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
          <p>Đang tải…</p>
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
          <form className="members-form" onSubmit={updatePackage}>
            <label>
              Tên gói
              <input
                onChange={(event) =>
                  setEditingPackage({
                    ...editingPackage,
                    name: event.target.value,
                  })
                }
                required
                value={editingPackage.name}
              />
            </label>
            <label>
              Giá (VNĐ)
              <input
                min="0"
                onChange={(event) =>
                  setEditingPackage({
                    ...editingPackage,
                    priceVnd: event.target.value,
                  })
                }
                required
                type="number"
                value={editingPackage.priceVnd}
              />
            </label>
            <label>
              Số ngày
              <input
                min="1"
                onChange={(event) =>
                  setEditingPackage({
                    ...editingPackage,
                    durationDays: event.target.value,
                  })
                }
                required
                type="number"
                value={editingPackage.durationDays}
              />
            </label>
            <label>
              Thứ hạng quyền
              <input
                min="1"
                onChange={(event) =>
                  setEditingPackage({
                    ...editingPackage,
                    tierRank: event.target.value,
                  })
                }
                required
                type="number"
                value={editingPackage.tierRank}
              />
            </label>
            <fieldset className="entitlement-fieldset">
              <legend>Quyền sử dụng</legend>
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
            <Button loading={submitting} type="submit">
              Lưu gói tập
            </Button>
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
        <p>Đang tải…</p>
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
