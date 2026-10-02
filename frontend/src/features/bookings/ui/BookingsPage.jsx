import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "../../../shared/ui/Button.jsx";
import {
  DataTableToolbar,
  FilterMenu,
  SortableHeader,
} from "../../../shared/ui/DataTable.jsx";
import { Dialog } from "../../../shared/ui/Dialog.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { usePagination } from "../../../shared/ui/usePagination.js";
import { sortTable } from "../../../shared/lib/table.js";
import { hasSessionPermission } from "../../auth/index.js";
import { useBookingsWorkspace } from "../api/useBookingsWorkspace.js";
import { TableSkeleton } from "../../../shared/ui/TableSkeleton.jsx";
import { UpcomingSchedule } from "./UpcomingSchedule.jsx";

const emptyForm = { memberId: "", classId: "" };
const labels = {
  confirmed: "Đã xác nhận",
  waitlisted: "Danh sách chờ",
  cancelled: "Đã hủy",
  attended: "Đã tham gia",
  absent: "Vắng mặt",
};

export function BookingsPage({ onNavigate, session }) {
  const [listMemberId, setListMemberId] = useState(undefined);
  const [form, setForm] = useState(emptyForm);
  const [cancellation, setCancellation] = useState({
    booking: null,
    reason: "",
  });
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilters, setBookingStatusFilters] = useState([]);
  const [bookingCoachFilters, setBookingCoachFilters] = useState([]);
  const [isBookingFilterOpen, setIsBookingFilterOpen] = useState(false);
  const [bookingSort, setBookingSort] = useState({
    key: "booked_at",
    direction: "desc",
  });
  const [isClassMenuOpen, setIsClassMenuOpen] = useState(false);
  const role = session?.user.role;
  const isMember = role === "member";
  const canCreateBooking = hasSessionPermission(session, "booking.write");
  const canCancelBooking = canCreateBooking;
  const workspace = useBookingsWorkspace({ canCreateBooking, isMember, memberId: listMemberId });
  const { bookings: items, classes, members } = workspace;
  const submitting = workspace.createBooking.isPending || workspace.cancelBooking.isPending;
  const visibleClasses = useMemo(
    () =>
      classes.filter(
        (item) =>
          item.status === "published" && new Date(item.starts_at) > new Date(),
      ),
    [classes],
  );
  const visibleBookings = useMemo(() => {
    const query = bookingSearch.trim().toLocaleLowerCase("vi");
    const filtered = items.filter(
      (item) =>
        (!bookingStatusFilters.length || bookingStatusFilters.includes(item.status)) &&
        (!bookingCoachFilters.length || bookingCoachFilters.includes(item.class_session?.coach_user_id)) &&
        (!query ||
          [
            item.booking_code,
            item.class_session?.name,
            item.class_session?.coach?.display_name,
          ].some((value) =>
            value?.toLocaleLowerCase("vi").includes(query),
          )),
    );
    return sortTable(
      filtered,
      bookingSort.key,
      bookingSort.direction,
      (item, key) => {
        if (key === "className") return item.class_session?.name;
        if (key === "classStartsAt") return item.class_session?.starts_at;
        return item[key];
      },
    );
  }, [bookingCoachFilters, bookingSearch, bookingSort, bookingStatusFilters, items]);
  const bookingsPagination = usePagination(visibleBookings);
  const bookingCoaches = useMemo(() => {
    const byId = new Map();
    items.forEach((item) => {
      const coach = item.class_session?.coach;
      const coachId = item.class_session?.coach_user_id;
      if (coachId && coach?.display_name) byId.set(coachId, coach.display_name);
    });
    return [...byId.entries()].map(([id, displayName]) => ({ id, displayName }));
  }, [items]);
  const selectedClass = visibleClasses.find((item) => item.id === form.classId);
  function toggleFilterValue(setter, value) {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function toggleBookingSort(key) {
    setBookingSort((value) => ({
      key,
      direction:
        value.key === key && value.direction === "asc" ? "desc" : "asc",
    }));
  }

  function updateForm(event) {
    setForm((value) => ({ ...value, [event.target.name]: event.target.value }));
  }

  async function create(event) {
    event.preventDefault();
    if (!form.classId) {
      workspace.setError("Hãy chọn lớp học trước khi đặt chỗ.");
      return;
    }
    workspace.createBooking.mutate({ classId: form.classId, ...(isMember ? {} : { memberId: form.memberId }) }, { onSuccess: () => { setForm(emptyForm); setListMemberId(isMember ? undefined : form.memberId); } });
  }

  function openCancellation(booking) {
    setCancellation({ booking, reason: "" });
  }
  function closeCancellation() {
    if (!submitting) setCancellation({ booking: null, reason: "" });
  }

  async function cancel(event) {
    event.preventDefault();
    if (!cancellation.booking || cancellation.reason.trim().length < 3) {
      workspace.setError("Lý do hủy cần có ít nhất 3 ký tự.");
      return;
    }
    workspace.cancelBooking.mutate({ id: cancellation.booking.id, reason: cancellation.reason.trim() }, { onSuccess: () => setCancellation({ booking: null, reason: "" }) });
  }

  return (
    <main className="members-page">
      <PageHeader eyebrow="Đặt chỗ" title={isMember ? "Lịch tập của tôi" : role === "coach" ? "Lịch đặt lớp phụ trách" : "Quản lý đặt lớp"} />
      {isMember && !workspace.loading && <UpcomingSchedule bookings={items} onNavigate={onNavigate} session={session} />}
      {workspace.error && (
        <p className="auth-alert" role="alert">
          {workspace.error}
        </p>
      )}
      {workspace.notice && (
        <p className="auth-success" role="status">
          {workspace.notice}
        </p>
      )}
      <section className="members-workspace-stacked">
        {canCreateBooking && (
          <form
            className={`members-form members-form--booking-create${isMember ? " members-form--booking-create-member" : ""}`}
            onSubmit={create}
          >
            <h2>{isMember ? "Đặt chỗ lớp học" : "Đặt lớp"}</h2>
          {!isMember && (
            <label>
              Hội viên
              <select
                name="memberId"
                onChange={updateForm}
                required
                value={form.memberId}
              >
                <option value="">Chọn hội viên</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} — {member.memberCode}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Lớp học
            <div className="class-session-select">
              <button
                aria-controls="class-session-options"
                aria-expanded={isClassMenuOpen}
                className="class-session-select__trigger"
                onClick={() => setIsClassMenuOpen((value) => !value)}
                type="button"
              >
                <span>{selectedClass?.name ?? "Chọn lớp đã công bố"}</span>
                <ChevronDown aria-hidden="true" size={18} />
              </button>
              {isClassMenuOpen && (
                <div
                  className="class-session-select__menu"
                  id="class-session-options"
                  role="listbox"
                >
                  {visibleClasses.length === 0 ? (
                    <p>Chưa có lớp đã công bố còn chỗ đặt.</p>
                  ) : (
                    visibleClasses.map((item) => (
                      <button
                        aria-selected={item.id === form.classId}
                        className="class-session-select__option"
                        key={item.id}
                        onClick={() => {
                          setForm((value) => ({ ...value, classId: item.id }));
                          setIsClassMenuOpen(false);
                        }}
                        role="option"
                        type="button"
                      >
                        <strong>{item.name}</strong>
                        <small>
                          {new Date(item.starts_at).toLocaleString("vi-VN")}
                        </small>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </label>
          <Button loading={submitting} type="submit">
            Đặt chỗ
          </Button>
        </form>
      )}
        <section className="members-list">
          <div className="list-heading">
            <h2>{isMember ? "Lịch đặt của tôi" : role === "coach" ? "Danh sách đặt chỗ" : "Lịch sử đặt chỗ"}</h2>
            <Button
              onClick={workspace.reload}
              size="sm"
              variant="ghost"
            >
              Tải lại
            </Button>
          </div>
          {workspace.loading ? (
            <TableSkeleton columns={6} />
          ) : items.length === 0 ? (
            <p>Chưa có lịch đặt chỗ.</p>
          ) : (
            <>
              <DataTableToolbar
                onClear={() => {
                  setBookingSearch("");
                  setBookingStatusFilters([]);
                  setBookingCoachFilters([]);
                }}
                resultCount={visibleBookings.length}
                search={bookingSearch}
                searchPlaceholder="Tìm mã hoặc tên lớp..."
                setSearch={setBookingSearch}
              >
                <FilterMenu activeCount={bookingStatusFilters.length + bookingCoachFilters.length} isOpen={isBookingFilterOpen} onToggle={() => setIsBookingFilterOpen((value) => !value)}>
                  <fieldset className="payment-filter-group">
                    <legend>Trạng thái</legend>
                    {Object.entries(labels).map(([value, label]) => (
                      <label key={value}>
                        <input checked={bookingStatusFilters.includes(value)} onChange={() => toggleFilterValue(setBookingStatusFilters, value)} type="checkbox" />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="payment-filter-group">
                    <legend>Coach phụ trách</legend>
                    {bookingCoaches.map((coach) => (
                      <label key={coach.id}>
                        <input checked={bookingCoachFilters.includes(coach.id)} onChange={() => toggleFilterValue(setBookingCoachFilters, coach.id)} type="checkbox" />
                        {coach.displayName}
                      </label>
                    ))}
                  </fieldset>
                </FilterMenu>
              </DataTableToolbar>
              {visibleBookings.length === 0 ? (
                <p>Không có lịch đặt chỗ phù hợp với bộ lọc.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <SortableHeader
                          activeSort={bookingSort.key}
                          column="booking_code"
                          direction={bookingSort.direction}
                          onSort={toggleBookingSort}
                        >
                          Mã đặt chỗ
                        </SortableHeader>
                        {!isMember && <th>Hội viên</th>}
                        <SortableHeader
                          activeSort={bookingSort.key}
                          column="className"
                          direction={bookingSort.direction}
                          onSort={toggleBookingSort}
                        >
                          Lớp học
                        </SortableHeader>
                        <SortableHeader
                          activeSort={bookingSort.key}
                          column="classStartsAt"
                          direction={bookingSort.direction}
                          onSort={toggleBookingSort}
                        >
                          Bắt đầu lớp
                        </SortableHeader>
                        <th>Kết thúc lớp</th>
                        <th>Coach phụ trách</th>
                        <th>Trạng thái</th>
                        <SortableHeader
                          activeSort={bookingSort.key}
                          column="booked_at"
                          direction={bookingSort.direction}
                          onSort={toggleBookingSort}
                        >
                          Thời điểm đặt
                        </SortableHeader>
                        {canCancelBooking && <th>Thao tác</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {bookingsPagination.pageItems.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <code>{item.booking_code}</code>
                          </td>
                          {!isMember && <td>{item.member?.full_name ?? "Hội viên"}</td>}
                          <td>{item.class_session?.name ?? "Lớp học"}</td>
                          <td>
                            {item.class_session?.starts_at
                              ? new Date(item.class_session.starts_at).toLocaleString("vi-VN")
                              : "—"}
                          </td>
                          <td>
                            {item.class_session?.ends_at
                              ? new Date(item.class_session.ends_at).toLocaleString("vi-VN")
                              : "—"}
                          </td>
                          <td>
                            {item.class_session?.coach?.display_name ?? "Chưa phân công"}
                          </td>
                          <td>{labels[item.status] ?? item.status}</td>
                          <td>
                            {new Date(item.booked_at).toLocaleString("vi-VN")}
                          </td>
                          {canCancelBooking && <td>
                            {["confirmed", "waitlisted"].includes(
                              item.status,
                            ) ? (
                              <Button
                                onClick={() => item.class_session?.pt_purchase_id ? onNavigate?.("pt") : openCancellation(item)}
                                size="sm"
                                variant="ghost"
                              >
                                {item.class_session?.pt_purchase_id ? "Quản lý lịch PT" : "Hủy"}
                              </Button>
                            ) : "—"}
                          </td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination {...bookingsPagination} />
            </>
          )}
        </section>
      </section>
      <Dialog
        isOpen={Boolean(cancellation.booking)}
        onClose={closeCancellation}
        title="Hủy đặt chỗ"
      >
        <form onSubmit={cancel}>
          <div className="dialog__body">
            <label>
              Lý do hủy
              <textarea
                minLength="3"
                onChange={(event) =>
                  setCancellation((value) => ({
                    ...value,
                    reason: event.target.value,
                  }))
                }
                required
                value={cancellation.reason}
              />
            </label>
          </div>
          <div className="dialog__actions">
            <Button
              disabled={submitting}
              onClick={closeCancellation}
              type="button"
              variant="secondary"
            >
              Quay lại
            </Button>
            <Button loading={submitting} type="submit" variant="danger">
              Xác nhận hủy
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
