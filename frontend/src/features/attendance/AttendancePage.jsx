import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Users } from "lucide-react";
import { Button } from "../../components/ui/Button.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { bookingApi } from "../bookings/booking-api.js";
import { classApi } from "../classes/class-api.js";
import { attendanceApi } from "./attendance-api.js";
import "../members/members.css";

const statusLabels = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Đi trễ",
  not_marked: "Chưa ghi nhận",
};
const classStatusLabels = {
  draft: "Bản nháp",
  published: "Đang mở",
  cancelled: "Đã hủy",
  completed: "Đã kết thúc",
};
const defaultCorrectionReason = "Điều chỉnh điểm danh";
const emptyCorrection = { record: null, status: "present", reason: defaultCorrectionReason };

export function AttendancePage({ session }) {
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [records, setRecords] = useState([]);
  const [draftStatuses, setDraftStatuses] = useState({});
  const [correction, setCorrection] = useState(emptyCorrection);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const role = session?.user?.role;
  const coachId = role === "coach" ? session.user.id : null;
  const canOperate = role === "coach";
  const canCorrect = role === "coach";
  const availableClasses = useMemo(() => {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return classes.filter(
      (item) =>
        (!coachId || item.coach_user_id === coachId) &&
        item.status === "published" &&
        new Date(item.starts_at) >= dayStart &&
        new Date(item.starts_at) < dayEnd,
    );
  }, [classes, coachId, now]);
  const classBookings = useMemo(
    () =>
      bookings.filter((item) =>
        ["confirmed", "attended"].includes(item.status),
      ),
    [bookings],
  );
  const attendanceRows = useMemo(() => {
    const recordsByMemberId = new Map(
      records.map((record) => [record.member_id, record]),
    );
    return classBookings.map((booking) => {
      const record = recordsByMemberId.get(booking.member_id);
      return record
        ? { ...record, member: record.member ?? booking.member, booking }
        : {
            id: `not-marked-${booking.id}`,
            booking,
            member: booking.member ?? null,
            member_id: booking.member_id,
            status: draftStatuses[booking.id] ?? "not_marked",
            checked_in_at: null,
            checked_out_at: null,
          };
    });
  }, [classBookings, records, draftStatuses]);
  const attendancePagination = usePagination(attendanceRows);
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === classId) ?? null,
    [classId, classes],
  );
  const attendanceSummary = useMemo(
    () =>
      attendanceRows.reduce(
        (summary, row) => ({
          ...summary,
          [row.status]: (summary[row.status] ?? 0) + 1,
        }),
        { present: 0, absent: 0, late: 0, not_marked: 0 },
      ),
    [attendanceRows],
  );
  const isSessionStarted = Boolean(
    selectedClass && now >= new Date(selectedClass.starts_at),
  );
  const isSessionOngoing = Boolean(
    selectedClass &&
      now >= new Date(selectedClass.starts_at) &&
      now <= new Date(selectedClass.ends_at),
  );
  const correctionRequiresReason = Boolean(
    selectedClass && now > new Date(selectedClass.ends_at),
  );

  const loadReferences = useCallback(async () => {
    setLoading(true);
    try {
      const nextClasses = await classApi.list();
      setClasses(nextClasses);
      setBookings([]);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadReferences);
  }, [loadReferences]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function refresh(nextClassId = classId) {
    if (!nextClassId) return;
    setRecords(await attendanceApi.byClass(nextClassId));
  }

  async function selectClass(input) {
    const selected = typeof input === "string" ? input : input.target.value;
    setClassId(selected);
    setRecords([]);
    setDraftStatuses({});
    setError("");
    if (!selected) return;
    try {
      const [, nextBookings] = await Promise.all([
        refresh(selected),
        bookingApi.byClass(selected),
      ]);
      setBookings(nextBookings);
    } catch (caught) {
      setError(caught.message);
    }
  }

  function checkIn(nextBookingId) {
    setError("");
    setNotice("");
    setDraftStatuses((current) => ({ ...current, [nextBookingId]: "present" }));
    setNotice("Đã đánh dấu có mặt. Hãy bấm Lưu điểm danh để ghi nhận chính thức.");
  }

  async function submitAttendance() {
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      const entries = attendanceRows.map((row) => ({ bookingId: row.booking.id, status: row.status === "not_marked" ? "absent" : row.status }));
      const result = await attendanceApi.submit(classId, entries);
      setDraftStatuses({});
      await refresh();
      setNotice(result.alreadySubmitted ? "Buổi học này đã được lưu trước đó." : `Đã lưu điểm danh và gửi thông báo cho ${result.notificationCount} hội viên.`);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  function openCorrection(record) {
    setCorrection({ record, status: record.status, reason: defaultCorrectionReason });
  }
  function closeCorrection() {
    if (!submitting) setCorrection(emptyCorrection);
  }

  async function correct(event) {
    event.preventDefault();
    if (
      !correction.record ||
      (correctionRequiresReason && correction.reason.trim().length < 3)
    ) {
      setError("Cần nhập lý do sửa điểm danh sau giờ học.");
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await attendanceApi.correct(correction.record.id, {
        status: correction.status,
        ...(correction.reason.trim()
          ? { reason: correction.reason.trim() }
          : {}),
      });
      await refresh();
      setCorrection(emptyCorrection);
      setNotice("Đã sửa điểm danh và lưu audit.");
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="members-page">
      <header>
        <p>Điểm danh</p>
        <h1>Điểm danh theo buổi học</h1>
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
      <div className="members-workspace-stacked">
        <section
          className="attendance-session-list members-list"
          aria-label="Danh sách buổi học"
        >
          <div className="list-heading">
            <div>
              <h2>Buổi học</h2>
              <p>Chọn một buổi để xem chi tiết điểm danh.</p>
            </div>
            <span className="attendance-session-list__count">
              {availableClasses.length} buổi học
            </span>
          </div>
          {loading ? (
            <p>Đang tải buổi học…</p>
          ) : availableClasses.length === 0 ? (
            <p>Hôm nay chưa có buổi học để điểm danh.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mã lớp</th>
                    <th>Buổi học</th>
                    <th>Thời gian</th>
                    <th>Coach phụ trách</th>
                    <th>Loại lớp</th>
                    <th>Sức chứa</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {availableClasses.map((item) => (
                    <tr
                      className={item.id === classId ? "is-selected" : ""}
                      key={item.id}
                    >
                      <td>
                        <code>{item.code}</code>
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                      </td>
                      <td>
                        {new Date(item.starts_at).toLocaleString("vi-VN")}
                      </td>
                      <td>{item.coach_name ?? "Chưa phân công"}</td>
                      <td>{item.type}</td>
                      <td>{item.capacity}</td>
                      <td>{classStatusLabels[item.status] ?? item.status}</td>
                      <td>
                        <Button
                          onClick={() => void selectClass(item.id)}
                          size="sm"
                          variant={
                            item.id === classId ? "secondary" : "outline"
                          }
                        >
                          {item.id === classId ? "Đang xem" : "Xem điểm danh"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedClass && (
            <div className="attendance-session-list__summary">
              <div>
                <span>BUỔI ĐANG XEM</span>
                <strong>{selectedClass.name}</strong>
                <small>
                  {new Date(selectedClass.starts_at).toLocaleString("vi-VN")}
                </small>
              </div>
              <div className="attendance-monitor__metrics">
                <div>
                  <Users aria-hidden="true" size={17} />
                  <span>Tổng booking</span>
                  <strong>{attendanceRows.length}</strong>
                </div>
                <div>
                  <ClipboardCheck aria-hidden="true" size={17} />
                  <span>Đã ghi nhận</span>
                  <strong>
                    {attendanceSummary.present +
                      attendanceSummary.late +
                      attendanceSummary.absent}
                  </strong>
                </div>
                <div>
                  <span>Chưa ghi nhận</span>
                  <strong>{attendanceSummary.not_marked}</strong>
                </div>
              </div>
            </div>
          )}
        </section>
        <section className="members-list">
          <div className="list-heading">
            <h2>Danh sách điểm danh lớp</h2>
            <div className="list-heading__actions">
              {classId && <Button disabled={submitting} onClick={submitAttendance} size="sm">Lưu điểm danh</Button>}
              {classId && <Button onClick={() => refresh()} size="sm" variant="ghost">Tải lại</Button>}
            </div>
          </div>
          {loading ? (
            <p>Đang tải dữ liệu…</p>
          ) : !classId ? (
            <p>Chưa chọn buổi học.</p>
          ) : attendanceRows.length === 0 ? (
            <p>Buổi học này chưa có hội viên đặt chỗ.</p>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mã hội viên</th>
                    <th>Hội viên</th>
                    <th>Trạng thái</th>
                    <th>Check-in</th>
                    {canOperate && <th>Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {attendancePagination.pageItems.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <code>
                          {record.member?.member_code ?? record.member_id}
                        </code>
                      </td>
                      <td>
                        {record.member ? (
                          <>
                            {record.member.full_name}
                            <br />
                            <small>{record.member.member_code}</small>
                          </>
                        ) : (
                          <code>{record.member_id}</code>
                        )}
                      </td>
                      <td>{statusLabels[record.status] ?? record.status}</td>
                      <td>
                        {record.checked_in_at
                          ? new Date(record.checked_in_at).toLocaleString(
                              "vi-VN",
                            )
                          : "—"}
                      </td>
                      {canOperate && (
                        <td>
                          {record.status === "not_marked" &&
                            isSessionOngoing && (
                              <Button
                                disabled={submitting}
                                onClick={() => checkIn(record.booking.id)}
                                size="sm"
                                type="button"
                              >
                                Điểm danh
                              </Button>
                            )}
                          {canCorrect &&
                            isSessionStarted &&
                            !record.id.startsWith("not-marked-") && (
                              <Button
                                disabled={submitting}
                                onClick={() => openCorrection(record)}
                                size="sm"
                                type="button"
                                variant="primary"
                              >
                                Sửa
                              </Button>
                            )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination {...attendancePagination} />
        </section>
      </div>
      <Dialog
        isOpen={Boolean(correction.record)}
        onClose={closeCorrection}
        title="Sửa điểm danh"
      >
        <form onSubmit={correct}>
          <div className="dialog__body">
            <label>
              Trạng thái mới
              <select
                disabled={submitting}
                onChange={(event) =>
                  setCorrection((value) => ({
                    ...value,
                    status: event.target.value,
                  }))
                }
                value={correction.status}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {correctionRequiresReason
                ? "Lý do sửa"
                : "Lý do sửa"}
              <textarea
                disabled={submitting}
                minLength={correctionRequiresReason ? 3 : undefined}
                onChange={(event) =>
                  setCorrection((value) => ({
                    ...value,
                    reason: event.target.value,
                  }))
                }
                required={correctionRequiresReason}
                value={correction.reason}
              />
            </label>
          </div>
          <div className="dialog__actions">
            <Button
              disabled={submitting}
              onClick={closeCorrection}
              type="button"
              variant="secondary"
            >
              Quay lại
            </Button>
            <Button loading={submitting} type="submit">
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
