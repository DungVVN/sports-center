import { useMemo, useState } from "react";
import { usePagination } from "../../../shared/ui/usePagination.js";
import { sortTable } from "../../../shared/lib/table.js";
import {
  entitlementLabel,
  entitlementLabels,
} from "../domain/membership-form.js";
import { Button } from "../../../shared/ui/Button.jsx";
import {
  DataTableToolbar,
  FilterMenu,
  SortableHeader,
} from "../../../shared/ui/DataTable.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { TableSkeleton } from "../../../shared/ui/TableSkeleton.jsx";
export function PackageCatalog({
  canCreatePackages,
  load,
  loading,
  openPackageEditor,
  packages,
}) {
  const [packageSearch, setPackageSearch] = useState("");
  const [packageStatusFilters, setPackageStatusFilters] = useState([]);
  const [packageDurationFilters, setPackageDurationFilters] = useState([]);
  const [packageEntitlementFilters, setPackageEntitlementFilters] = useState(
    [],
  );
  const [isPackageFilterOpen, setIsPackageFilterOpen] = useState(false);
  const [packageSort, setPackageSort] = useState({
    key: "tierRank",
    direction: "asc",
  });
  const visiblePackages = useMemo(() => {
    const query = packageSearch.trim().toLocaleLowerCase("vi");
    const filtered = packages.filter((item) => {
      const matchesQuery =
        !query ||
        [item.name, item.code].some((value) =>
          value?.toLocaleLowerCase("vi").includes(query),
        );
      const matchesStatus =
        !packageStatusFilters.length ||
        packageStatusFilters.includes(item.isActive ? "active" : "inactive");
      const matchesDuration =
        !packageDurationFilters.length ||
        packageDurationFilters.includes(String(item.durationDays));
      const matchesEntitlement =
        !packageEntitlementFilters.length ||
        item.entitlements.some((entry) =>
          packageEntitlementFilters.includes(entry.entitlement),
        );
      return (
        matchesQuery && matchesStatus && matchesDuration && matchesEntitlement
      );
    });
    return sortTable(
      filtered,
      packageSort.key,
      packageSort.direction,
      (item, key) => item[key],
    );
  }, [
    packageDurationFilters,
    packageEntitlementFilters,
    packageSearch,
    packageSort,
    packageStatusFilters,
    packages,
  ]);
  const packagesPagination = usePagination(visiblePackages);
  const packageDurations = useMemo(
    () =>
      [...new Set(packages.map((item) => String(item.durationDays)))].sort(
        (first, second) => Number(first) - Number(second),
      ),
    [packages],
  );
  function toggleFilterValue(setter, value) {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }
  function togglePackageSort(key) {
    setPackageSort((value) => ({
      key,
      direction:
        value.key === key && value.direction === "asc" ? "desc" : "asc",
    }));
  }
  return (
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
            onClear={() => {
              setPackageSearch("");
              setPackageStatusFilters([]);
              setPackageDurationFilters([]);
              setPackageEntitlementFilters([]);
            }}
            resultCount={visiblePackages.length}
            search={packageSearch}
            searchPlaceholder="Tìm tên hoặc mã gói..."
            setSearch={setPackageSearch}
          >
            <FilterMenu
              activeCount={
                packageStatusFilters.length +
                packageDurationFilters.length +
                packageEntitlementFilters.length
              }
              className="filter-menu--package"
              isOpen={isPackageFilterOpen}
              onToggle={() => setIsPackageFilterOpen((value) => !value)}
            >
              <fieldset className="payment-filter-group">
                <legend>Trạng thái</legend>
                {[
                  ["active", "Đang dùng"],
                  ["inactive", "Ngừng dùng"],
                ].map(([value, label]) => (
                  <label key={value}>
                    <input
                      checked={packageStatusFilters.includes(value)}
                      onChange={() =>
                        toggleFilterValue(setPackageStatusFilters, value)
                      }
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              <fieldset className="payment-filter-group">
                <legend>Thời hạn</legend>
                {packageDurations.length ? (
                  packageDurations.map((duration) => (
                    <label key={duration}>
                      <input
                        checked={packageDurationFilters.includes(duration)}
                        onChange={() =>
                          toggleFilterValue(setPackageDurationFilters, duration)
                        }
                        type="checkbox"
                      />
                      {duration} ngày
                    </label>
                  ))
                ) : (
                  <p>Chưa có thời hạn gói để lọc.</p>
                )}
              </fieldset>
              <fieldset className="payment-filter-group">
                <legend>Quyền sử dụng</legend>
                {Object.entries(entitlementLabels).map(([code, label]) => (
                  <label key={code}>
                    <input
                      checked={packageEntitlementFilters.includes(code)}
                      onChange={() =>
                        toggleFilterValue(setPackageEntitlementFilters, code)
                      }
                      type="checkbox"
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            </FilterMenu>
          </DataTableToolbar>
          {visiblePackages.length === 0 ? (
            <p>Không có gói phù hợp với bộ lọc.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mã gói</th>
                    <SortableHeader
                      activeSort={packageSort.key}
                      column="name"
                      direction={packageSort.direction}
                      onSort={togglePackageSort}
                    >
                      Tên gói
                    </SortableHeader>
                    <SortableHeader
                      activeSort={packageSort.key}
                      column="durationDays"
                      direction={packageSort.direction}
                      onSort={togglePackageSort}
                    >
                      Thời hạn gói
                    </SortableHeader>
                    <SortableHeader
                      activeSort={packageSort.key}
                      column="priceVnd"
                      direction={packageSort.direction}
                      onSort={togglePackageSort}
                    >
                      Giá gói
                    </SortableHeader>
                    <th>Quyền sử dụng</th>
                    {canCreatePackages && <th>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {packagesPagination.pageItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code>{item.code}</code>
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                        <small>Hạng {item.tierRank}</small>
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
                      {canCreatePackages && (
                        <td>
                          <Button
                            onClick={() => openPackageEditor(item)}
                            size="sm"
                            variant="primary"
                          >
                            Sửa
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination {...packagesPagination} />
        </>
      )}
    </section>
  );
}
