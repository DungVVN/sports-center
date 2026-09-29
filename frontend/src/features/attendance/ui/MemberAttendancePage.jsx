import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../../shared/ui/Button.jsx";
import { Pagination } from "../../../shared/ui/Pagination.jsx";
import { usePagination } from "../../../shared/ui/usePagination.js";
import { classApi } from "../../classes/index.js";
import { attendanceApi } from "../api/attendance-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";

const labels = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Đi trễ",
  not_marked: "Chưa ghi nhận",
};
const format = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

export function MemberAttendancePage() {
  const attendanceQuery = useQuery({ queryKey: ["member", "attendance"], queryFn: attendanceApi.mine });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: classApi.list });
  const records = attendanceQuery.data ?? [];
  const classesById = useMemo(() => Object.fromEntries((classesQuery.data ?? []).map((item) => [item.id, item])), [classesQuery.data]);
  const recordsPagination = usePagination(records);


  return (
    <main className="members-page">
      <header>
        <p>Điểm danh</p>
        <h1>Lịch sử điểm danh</h1>
      </header>
      {attendanceQuery.isError && <p className="auth-alert" role="alert">{errorMessageFor(attendanceQuery.error, "Không thể tải lịch sử điểm danh.")}</p>}
      {classesQuery.isError && <p className="auth-alert" role="alert">{errorMessageFor(classesQuery.error, "Không thể tải thông tin lớp học.")}</p>}
      <section className="members-list">
        <div className="list-heading">
          <h2>Các buổi học của tôi</h2>
          <Button onClick={() => { attendanceQuery.refetch(); classesQuery.refetch(); }} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        {attendanceQuery.isLoading ? (
          <p>Đang tải lịch sử điểm danh…</p>
        ) : records.length === 0 ? (
          <p>Chưa có lượt điểm danh nào.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Lớp học</th>
                    <th>HLV phụ trách</th>
                    <th>Trạng thái</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Ghi nhận lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {recordsPagination.pageItems.map((record) => {
                    const session = classesById[record.class_session_id];
                    return (
                      <tr key={record.id}>
                        <td>
                          {session ? (
                            <>
                              <strong>{session.name}</strong>
                              <br />
                              <small>
                                {session.room_name ?? "Phòng tập"} · {new Date(session.starts_at).toLocaleDateString("vi-VN")}
                              </small>
                            </>
                          ) : (
                            <code>{record.class_session_id}</code>
                          )}
                        </td>
                        <td>{session?.coach_name ?? "—"}</td>
                        <td>
                          <span
                            className={
                              record.status === "present"
                                ? "badge badge--success"
                                : record.status === "absent"
                                ? "badge badge--danger"
                                : "badge"
                            }
                          >
                            {labels[record.status] ?? record.status}
                          </span>
                        </td>
                        <td>{format(record.checked_in_at)}</td>
                        <td>{format(record.checked_out_at)}</td>
                        <td>{format(record.recorded_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...recordsPagination} />
          </>
        )}
      </section>
    </main>
  );
}
