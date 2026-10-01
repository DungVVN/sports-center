import { statusLabels } from "../domain/class-form.js";
import { useMemo } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import {
  DataTableToolbar,
  FilterMenu,
  SortableHeader,
} from "../../../shared/ui/DataTable.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { usePagination } from "../../../shared/ui/usePagination.js";
import { TableSkeleton } from "../../../shared/ui/TableSkeleton.jsx";
export function ClassListContent({
  canManage,
  classCoachFilters,
  classRoomFilters,
  classStatusFilters,
  classSearch,
  classSort,
  coaches,
  loading,
  onClear,
  onEdit,
  isClassFilterOpen,
  onFilterOpenChange,
  onPublish,
  onSearchChange,
  onSort,
  onToggleFilter,
  rooms,
  submitting,
  visibleClassRows,
}) {
  const coachNameById = useMemo(
    () => new Map(coaches.map((coach) => [coach.id, coach.display_name])),
    [coaches],
  );
  const roomNameById = useMemo(
    () => new Map(rooms.map((room) => [room.id, room.name])),
    [rooms],
  );
  const classPagination = usePagination(visibleClassRows);
  return loading ? (
    <TableSkeleton columns={6} />
  ) : (
    <>
      <DataTableToolbar
        onClear={onClear}
        resultCount={visibleClassRows.length}
        search={classSearch}
        searchPlaceholder="Tìm ID, tên hoặc loại lớp..."
        setSearch={onSearchChange}
      >
        <FilterMenu
          activeCount={
            classStatusFilters.length +
            classCoachFilters.length +
            classRoomFilters.length
          }
          isOpen={isClassFilterOpen}
          onToggle={() => onFilterOpenChange(!isClassFilterOpen)}
        >
          <fieldset className="payment-filter-group">
            <legend>Trạng thái</legend>
            {Object.entries(statusLabels).map(([value, label]) => (
              <label key={value}>
                <input
                  checked={classStatusFilters.includes(value)}
                  onChange={() => onToggleFilter("status", value)}
                  type="checkbox"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset className="payment-filter-group">
            <legend>Coach phụ trách</legend>
            {coaches.map((coach) => (
              <label key={coach.id}>
                <input
                  checked={classCoachFilters.includes(coach.id)}
                  onChange={() => onToggleFilter("coach", coach.id)}
                  type="checkbox"
                />
                {coach.display_name}
              </label>
            ))}
          </fieldset>
          <fieldset className="payment-filter-group">
            <legend>Phòng</legend>
            {rooms.map((room) => (
              <label key={room.id}>
                <input
                  checked={classRoomFilters.includes(room.id)}
                  onChange={() => onToggleFilter("room", room.id)}
                  type="checkbox"
                />
                {room.name}
              </label>
            ))}
          </fieldset>
        </FilterMenu>
      </DataTableToolbar>
      {visibleClassRows.length === 0 ? (
        <p>Không có lớp học phù hợp với bộ lọc.</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <SortableHeader
                  activeSort={classSort.key}
                  column="id"
                  direction={classSort.direction}
                  onSort={onSort}
                >
                  Mã lớp học
                </SortableHeader>
                <SortableHeader
                  activeSort={classSort.key}
                  column="name"
                  direction={classSort.direction}
                  onSort={onSort}
                >
                  Tên lớp
                </SortableHeader>
                <SortableHeader
                  activeSort={classSort.key}
                  column="starts_at"
                  direction={classSort.direction}
                  onSort={onSort}
                >
                  Bắt đầu
                </SortableHeader>
                <th>Coach phụ trách</th>
                <th>Phòng</th>
                <SortableHeader
                  activeSort={classSort.key}
                  className="classes-capacity-cell"
                  column="capacity"
                  direction={classSort.direction}
                  onSort={onSort}
                >
                  Sức chứa
                </SortableHeader>
                <th>Trạng thái</th>
                {canManage && <th>Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {classPagination.pageItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <code>{item.id}</code>
                  </td>
                  <td>
                    <strong>{item.name}</strong>
                    <small>{item.type}</small>
                  </td>
                  <td>{new Date(item.starts_at).toLocaleString("vi-VN")}</td>
                  <td>
                    {coachNameById.get(item.coach_user_id) ?? "Chưa phân công"}
                  </td>
                  <td>{roomNameById.get(item.room_id) ?? "Chưa có phòng"}</td>
                  <td className="classes-capacity-cell">{item.capacity}</td>
                  <td>{statusLabels[item.status] ?? item.status}</td>
                  {canManage && (
                    <td>
                      <>
                        <Button
                          disabled={submitting}
                          onClick={() => onEdit(item)}
                          size="sm"
                          variant="primary"
                        >
                          Sửa
                        </Button>
                        {item.status === "draft" && (
                          <Button
                            disabled={submitting}
                            onClick={() => onPublish(item.id)}
                            size="sm"
                            variant="secondary"
                          >
                            Công bố
                          </Button>
                        )}
                      </>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination {...classPagination} />
    </>
  );
}
