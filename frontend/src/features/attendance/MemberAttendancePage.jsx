import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { classApi } from "../classes/class-api.js";
import { attendanceApi } from "./attendance-api.js";
import "../members/members.css";

const labels = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Đi trễ",
  not_marked: "Chưa ghi nhận",
};
const format = (value) => (value ? new Date(value).toLocaleString("vi-VN") : "—");

export function MemberAttendancePage() {
  const [records, setRecords] = useState([]);
  const [classesById, setClassesById] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const recordsPagination = usePagination(records);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [attList, classList] = await Promise.all([
        attendanceApi.mine(),
        classApi.list().catch(() => []),
      ]);
      const map = {};
      if (Array.isArray(classList)) {
        for (const item of classList) {
          map[item.id] = item;
        }
      }
      setClassesById(map);
      setRecords(attList);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  return (
    <main className="members-page">
      <header>
        <p>Điểm danh</p>
        <h1>Lịch sử điểm danh</h1>
      </header>
      {error && <p className="auth-alert" role="alert">{error}</p>}
      <section className="members-list">
        <div className="list-heading">
          <h2>Các buổi học của tôi</h2>
          <Button onClick={load} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        {loading ? (
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
