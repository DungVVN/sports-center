import { PageHeader } from "../../../shared/ui/PageHeader.jsx";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { classApi } from "../../classes/index.js";
import { dashboardApi } from "../api/dashboard-api.js";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { useMutationFeedback } from "../../../shared/lib/useMutationFeedback.js";
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
  const feedback = useMutationFeedback();
  const customRangeComplete = Boolean(range.from && range.to);
  const customRangeReversed = customRangeComplete && range.from > range.to;
  const canRequestReport = period !== "custom" || (customRangeComplete && !customRangeReversed);
  const query = { period, ...(period === "custom" ? range : {}), ...(coachUserId ? { coachUserId } : {}) };
  const reportQuery = useQuery({ queryKey: ["reports", query], queryFn: async () => { const [revenue, attendance] = await Promise.all([dashboardApi.revenue(query), dashboardApi.attendance(query)]); return { attendance, revenue }; }, enabled: canRequestReport });
  const coachesQuery = useQuery({ queryKey: ["coaches"], queryFn: classApi.coaches });
  const coaches = coachesQuery.data ?? [];
  const report = reportQuery.data?.revenue ?? null;
  const attendance = reportQuery.data?.attendance ?? null;
  const loading = reportQuery.isLoading;

  const dateRange = !canRequestReport ? "Chưa chọn khoảng ngày hợp lệ" : report ? `${new Date(report.from).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} – ${new Date(report.to).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : "Đang tải…";
  async function download(type) {
    const label = type === "revenue" ? "doanh thu" : "điểm danh";
    try {
      feedback.clear();
      await dashboardApi.exportCsv(type, query);
      feedback.setNotice(`Đã tải báo cáo ${label}.`);
    } catch (caught) {
      feedback.setError(errorMessageFor(caught, `Không thể tải báo cáo ${label}.`));
    }
  }
  return (
    <main className="members-page">
      <PageHeader eyebrow="Báo cáo" title="Doanh thu và điểm danh" />
      {feedback.error && <p className="auth-alert" role="alert">{feedback.error}</p>}
      {feedback.notice && <p className="auth-success" role="status">{feedback.notice}</p>}
      {reportQuery.isError && <p className="auth-alert" role="alert">{errorMessageFor(reportQuery.error, "Không thể tải số liệu báo cáo.")}</p>}
      {coachesQuery.isError && <p className="auth-alert" role="alert">{errorMessageFor(coachesQuery.error, "Không thể tải danh sách huấn luyện viên.")}</p>}
      <section className="members-list reports-page__content">
        <section className="report-period">
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <strong>Khoảng thời gian</strong>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {periods.map(([value, label]) => (
                  <button aria-pressed={period === value} className={period === value ? "is-selected" : ""} key={value} onClick={() => setPeriod(value)} type="button">
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <button disabled={loading || !canRequestReport} onClick={() => void download("revenue")} type="button">Tải CSV doanh thu</button>
              <button disabled={loading || !canRequestReport} onClick={() => void download("attendance")} type="button">Tải CSV điểm danh</button>
            </div>
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
            <>
              <p>
                <label>Từ ngày <input type="date" value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} /></label>
                <label>Đến ngày <input type="date" value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} /></label>
              </p>
              {!customRangeComplete && <p>Chọn ngày bắt đầu và kết thúc để xem báo cáo.</p>}
              {customRangeReversed && <p className="auth-alert" role="alert">Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.</p>}
            </>
          )}
          <small>Dữ liệu: <b>{dateRange}</b></small>

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
                    <p className="report-help">Thực thu = tiền nhận trong kỳ trừ tiền thực tế hoàn trong kỳ. Khoản thu gốc giữ nguyên ngày xác nhận.</p>
                  </div>
                </div>
                <div className="report-metrics report-metrics--revenue">
                  <Metric label="Thực thu" value={money(report.paid)} note={`${number(report.payments)} giao dịch đã thanh toán`} tone="success" />
                  <Metric label="Đã hoàn trong kỳ" value={money(report.refunded ?? "0")} note={`Tổng tiền nhận: ${money(report.gross ?? report.paid)}`} />
                  <Metric label="Chờ xác nhận" value={money(report.createdSummary.pending)} note={`${number(report.createdSummary.pendingPayments)} phiếu tạo trong kỳ`} tone="warning" />
                  <Metric label="Giá trị giao dịch" value={money(report.createdSummary.transactionValue)} note="Đã thu và đang chờ trong kỳ" />
                  <Metric label="Tỷ lệ hoàn tất" value={report.createdSummary.completionRate === null ? "—" : `${report.createdSummary.completionRate}%`} note="Trên số tiền cần thu trong kỳ" tone="info" />
                </div>
              </section>
              <section className="report-section">
                <h2>Thực thu theo dịch vụ</h2>
                <p className="report-help">Khoản đã nhận nhưng chưa cấp được quyền sử dụng vẫn là tiền đã thu và được đánh dấu để đối soát.</p>
                <table><thead><tr><th>Dịch vụ</th><th>Số giao dịch</th><th>Thực thu</th><th>Cần đối soát</th></tr></thead><tbody>{(report.byService ?? []).map((item) => <tr key={item.type}><th scope="row">{item.name}</th><td>{number(item.payments)}</td><td>{money(item.amountVnd)}</td><td>{number(item.requiresReview)}</td></tr>)}</tbody></table>
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
