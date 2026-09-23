import { useCallback, useEffect, useState } from "react";
import { classApi } from "../classes/class-api.js";
import { dashboardApi } from "./dashboard-api.js";
import "../members/members.css";
import "./reports.css";
const periods = [["day","Ngày"],["week","Tuần"],["month","Tháng"],["quarter","Quý"],["year","Năm"],["custom","Tùy chọn"]];
const paymentLabels = { pending: "Chờ xác nhận", paid: "Đã thanh toán", failed: "Thất bại", refunded: "Đã hoàn tiền" };
const attendanceLabels = { present: "Có mặt", absent: "Vắng mặt", late: "Đi trễ", not_marked: "Chưa ghi nhận" };
const money = (value) => `${Number(value ?? 0).toLocaleString("vi-VN")} ₫`;
const number = (value) => Number(value ?? 0).toLocaleString("vi-VN");
function Metric({ label, value, note, tone }) { return <article className={`report-metric ${tone ?? ""}`}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>; }
function Trend({ revenue, attendance }) { const points = revenue.trend ?? []; const max = Math.max(0, ...points.map((item) => Number(item.amountVnd))); const labelEvery = Math.max(1, Math.ceil(points.length / 7)); return <section className="report-section"><h2>Xu hướng thực thu</h2><p className="report-help">Cột biểu thị doanh thu đã xác nhận theo từng ngày trong kỳ.</p>{max === 0 ? <p className="report-chart__empty">Chưa có doanh thu đã xác nhận trong kỳ đã chọn.</p> : <div className="report-chart" role="img" aria-label="Biểu đồ thực thu theo ngày">{points.map((item, index) => <div className="report-chart__day" key={item.date} title={`${new Date(item.date).toLocaleDateString("vi-VN")}: ${money(item.amountVnd)}; ${number((attendance.trend?.[index]?.present ?? 0) + (attendance.trend?.[index]?.late ?? 0))} lượt có mặt`}><i style={{ height: `${Math.max(3, Number(item.amountVnd) / max * 100)}%` }} /><small>{index % labelEvery === 0 ? new Date(item.date).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : ""}</small></div>)}</div>}</section>; }
export function ReportsPage() {
  const [period, setPeriod] = useState("month");
  const [range, setRange] = useState({ from: "", to: "" });
  const [coachUserId, setCoachUserId] = useState("");
  const [coaches, setCoaches] = useState([]);
  const [report, setReport] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    classApi.coaches().then(setCoaches).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const query = { period, ...(period === "custom" ? range : {}), ...(coachUserId ? { coachUserId } : {}) };
      const [revenue, nextAttendance] = await Promise.all([dashboardApi.revenue(query), dashboardApi.attendance(query)]);
      setReport(revenue);
      setAttendance(nextAttendance);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setLoading(false);
    }
  }, [period, range, coachUserId]);

  useEffect(() => {
    if (period !== "custom" || (range.from && range.to)) void Promise.resolve().then(load);
  }, [load, period, range]);

  const dateRange = report ? `${new Date(report.from).toLocaleDateString("vi-VN")} – ${new Date(report.to).toLocaleDateString("vi-VN")}` : "Đang tải…";
  const query = { period, ...(period === "custom" ? range : {}), ...(coachUserId ? { coachUserId } : {}) };
  async function download(type) { try { setError(""); await dashboardApi.exportCsv(type, query); } catch (caught) { setError(caught.message); } }
  return (
    <main className="members-page">
      <header>
        <p>Báo cáo</p>
        <h1>Doanh thu và điểm danh</h1>
      </header>
      {error && <p className="auth-alert" role="alert">{error}</p>}
      <section className="members-list reports-page__content">
        <section className="report-period">
          <strong>Khoảng thời gian</strong>
          <div>
            {periods.map(([value, label]) => (
              <button aria-pressed={period === value} className={period === value ? "is-selected" : ""} key={value} onClick={() => setPeriod(value)} type="button">
                {label}
              </button>
            ))}
          </div>
          <label>
            Huấn luyện viên (lọc điểm danh)
            <select value={coachUserId} onChange={(event) => setCoachUserId(event.target.value)}>
              <option value="">Tất cả huấn luyện viên</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.display_name}
                </option>
              ))}
            </select>
          </label>
          {period === "custom" && (
            <p>
              <label>Từ ngày <input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label>
              <label>Đến ngày <input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label>
            </p>
          )}
          <small>Dữ liệu: <b>{dateRange}</b></small>
          <p>
            <button disabled={loading} onClick={() => void download("revenue")} type="button">Tải CSV doanh thu</button>{" "}
            <button disabled={loading} onClick={() => void download("attendance")} type="button">Tải CSV điểm danh</button>
          </p>
        </section>
        {loading ? (
          <p>Đang tải báo cáo…</p>
        ) : (
          report && attendance && (
            <>
              <section className="report-section">
                <div className="report-heading">
                  <div>
                    <h2>Tổng quan thu tiền</h2>
                    <p className="report-help">Thực thu tính theo thời điểm xác nhận thanh toán.</p>
                  </div>
                </div>
                <div className="report-metrics">
                  <Metric label="Thực thu" value={money(report.paid)} note={`${number(report.payments)} giao dịch đã thanh toán`} tone="success" />
                  <Metric label="Chờ xác nhận" value={money(report.createdSummary.pending)} note={`${number(report.createdSummary.pendingPayments)} phiếu tạo trong kỳ`} tone="warning" />
                  <Metric label="Giá trị giao dịch" value={money(report.createdSummary.transactionValue)} note="Đã thu và đang chờ trong kỳ" />
                  <Metric label="Tỷ lệ hoàn tất" value={report.createdSummary.completionRate === null ? "—" : `${report.createdSummary.completionRate}%`} note="Trên số tiền cần thu trong kỳ" tone="info" />
                </div>
              </section>
              <section className="report-section">
                <h2>Trạng thái phiếu thu</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Trạng thái</th>
                      <th>Số giao dịch</th>
                      <th>Tổng giá trị</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.paymentStatuses.map((item) => (
                      <tr key={item.status}>
                        <td>{paymentLabels[item.status] ?? item.status}</td>
                        <td>{number(item.count)}</td>
                        <td>{money(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <section className="report-section">
                <h2>Điểm danh</h2>
                <div className="report-metrics">
                  <Metric label="Tổng lượt" value={number(attendance.summary.total)} note="Bao gồm lượt chưa ghi nhận" />
                  <Metric label="Đã tham gia" value={number(attendance.summary.attended)} note="Có mặt và đi trễ" tone="success" />
                  <Metric label="Vắng mặt" value={number(attendance.summary.absent)} note="Đã đánh dấu vắng" tone="warning" />
                  <Metric label="Tỷ lệ tham gia" value={attendance.summary.attendanceRate === null ? "—" : `${attendance.summary.attendanceRate}%`} note={`${number(attendance.summary.notMarked)} lượt chưa ghi nhận`} tone="info" />
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Trạng thái</th>
                      <th>Số lượt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.byStatus.map((item) => (
                      <tr key={item.status}>
                        <td>{attendanceLabels[item.status] ?? item.status}</td>
                        <td>{number(item._count.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
              <Trend attendance={attendance} revenue={report} />
            </>
          )
        )}
      </section>
    </main>
  );
}
