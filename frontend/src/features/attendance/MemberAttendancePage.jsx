import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { attendanceApi } from "./attendance-api.js";
import "../members/members.css";

const labels = { present: "Có mặt", absent: "Vắng", late: "Đi trễ", not_marked: "Chưa ghi nhận" };
const format = (value) => value ? new Date(value).toLocaleString("vi-VN") : "—";

export function MemberAttendancePage() {
  const [records, setRecords] = useState([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setRecords(await attendanceApi.mine()); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <main className="members-page"><header><p>Điểm danh</p><h1>Lịch sử điểm danh</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}<section className="members-list"><div className="list-heading"><h2>Các buổi học của tôi</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải lịch sử điểm danh…</p> : records.length === 0 ? <p>Chưa có lượt điểm danh nào.</p> : <div className="table-scroll"><table><thead><tr><th>Trạng thái</th><th>Check-in</th><th>Check-out</th><th>Ghi nhận</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td>{labels[record.status] ?? record.status}</td><td>{format(record.checked_in_at)}</td><td>{format(record.checked_out_at)}</td><td>{format(record.recorded_at)}</td></tr>)}</tbody></table></div>}</section></main>;
}
