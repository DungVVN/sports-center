import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, CalendarDays, CircleAlert, ClipboardCheck, CreditCard, ReceiptText, UsersRound } from "lucide-react";
import { dashboardApi } from "./dashboard-api.js";
import "./dashboard-home.css";
import "./dashboard-typography.css";

const periods = [
  { id: "day", label: "Hôm nay" },
  { id: "week", label: "Tuần này" },
  { id: "month", label: "Tháng này" },
  { id: "quarter", label: "Quý này" },
  { id: "year", label: "Năm nay" },
];

const roleKpis = {
  receptionist: [
    { key: "todayClasses", label: "Lớp diễn ra hôm nay", target: "classes" },
    { key: "pendingPayments", label: "Tiền mặt chờ xác nhận", target: "payments" },
    { key: "expiringMemberships", label: "Gói hết hạn trong 7 ngày", target: "packages" },
  ],
  coach: [
    { key: "todayClasses", label: "Lớp phụ trách hôm nay", target: "attendance" },
    { key: "pendingPayments", label: "Lịch lớp học", target: "classes" },
    { key: "expiringMemberships", label: "Kế hoạch tập luyện", target: "training" },
  ],
  member: [
    { key: "todayClasses", label: "Lớp học & Lịch tập", target: "bookings" },
    { key: "pendingPayments", label: "Phiếu thu của tôi", target: "my-payments" },
    { key: "expiringMemberships", label: "Gói tập của tôi", target: "packages" },
  ],
};

const formatMoney = (value) => `${Number(value ?? 0).toLocaleString("vi-VN")} ₫`;
const formatPercent = (value) =>
  value === null || value === undefined
    ? "Chưa có dữ liệu"
    : `${value.toLocaleString("vi-VN")}%`;

function Change({ value }) {
  if (value === null || value === undefined)
    return <span className="dashboard-change dashboard-change--neutral">Chưa đủ dữ liệu để so sánh</span>;
  return (
    <span className={value >= 0 ? "dashboard-change dashboard-change--up" : "dashboard-change dashboard-change--down"}>
      {value >= 0 ? "+" : ""}{value}% so với kỳ trước
    </span>
  );
}

function MetricCard({ change, icon: Icon, label, onClick, value }) {
  return (
    <article
      className={`dashboard-metric ${onClick ? "dashboard-metric--interactive" : ""}`.trim()}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <span className="dashboard-metric__icon">
        <Icon aria-hidden="true" size={19} />
      </span>
      <span className="dashboard-metric__label">{label}</span>
      <strong>{value}</strong>
      {change !== undefined && <Change value={change} />}
    </article>
  );
}

function ManagerDashboard({ onNavigate, summary }) {
  const metrics = summary?.metrics;
  const occupancyRate = metrics?.occupancyRate ?? 0;
  const attendanceRate = metrics?.attendanceRate ?? 0;
  const availableSlots = metrics ? Math.max(metrics.capacity - metrics.bookings, 0) : null;
  const chartData = (summary?.revenueTrend ?? []).map((item) => ({
    ...item,
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    }),
    revenue: Number(item.amountVnd),
  }));

  return (
    <>
      <section className="dashboard-metrics" aria-label="Chỉ số chính">
        <MetricCard
          change={summary?.comparison?.revenueChange}
          icon={CreditCard}
          label="Doanh thu đã thu"
          onClick={() => onNavigate?.("reports")}
          value={metrics ? formatMoney(metrics.revenueVnd) : "—"}
        />
        <MetricCard
          change={summary?.comparison?.newMembersChange}
          icon={UsersRound}
          label="Hội viên mới"
          onClick={() => onNavigate?.("members")}
          value={metrics?.newMembers ?? "—"}
        />
        <MetricCard
          change={summary?.comparison?.bookingsChange}
          icon={CalendarDays}
          label="Lượt đặt chỗ"
          onClick={() => onNavigate?.("classes")}
          value={metrics?.bookings ?? "—"}
        />
        <MetricCard
          change={summary?.comparison?.attendanceChange}
          icon={ClipboardCheck}
          label="Tỷ lệ điểm danh"
          onClick={() => onNavigate?.("reports")}
          value={formatPercent(metrics?.attendanceRate)}
        />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel dashboard-panel--chart">
          <div className="dashboard-panel__heading">
            <h2>Xu hướng doanh thu</h2>
          </div>
          <div className="dashboard-chart">
            {chartData.length ? (
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={chartData} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revenue-gradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis axisLine={false} dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} tickLine={false} />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    tickFormatter={(value) => `${Math.round(value / 1000000)}tr`}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip formatter={(value) => formatMoney(value)} labelStyle={{ color: "#102A43" }} />
                  <Area dataKey="revenue" fill="url(#revenue-gradient)" stroke="#2563EB" strokeWidth={2.5} type="monotone" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="dashboard-empty">Chưa có phiếu thu đã xác nhận trong kỳ này.</p>
            )}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="dashboard-panel__heading">
            <h2>Việc cần chú ý</h2>
          </div>
          <div className="dashboard-alerts">
            <div
              className="dashboard-alert--interactive"
              onClick={() => onNavigate?.("payments")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate?.("payments"); }}
              role="button"
              tabIndex={0}
            >
              <span>
                <CircleAlert aria-hidden="true" size={18} />
                <strong>{summary?.alerts?.pendingPayments ?? "—"} phiếu thu chờ xác nhận</strong>
              </span>
            </div>
            <div
              className="dashboard-alert--interactive"
              onClick={() => onNavigate?.("packages")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onNavigate?.("packages"); }}
              role="button"
              tabIndex={0}
            >
              <span>
                <CalendarDays aria-hidden="true" size={18} />
                <strong>{summary?.alerts?.expiringMemberships ?? "—"} gói hết hạn trong 7 ngày</strong>
              </span>
            </div>
          </div>
          <dl className="dashboard-performance">
            <div>
              <dt>Lớp diễn ra</dt>
              <dd>{metrics?.classes ?? "—"}</dd>
            </div>
            <div>
              <dt>Tỷ lệ lấp đầy</dt>
              <dd>{formatPercent(metrics?.occupancyRate)}</dd>
            </div>
            <div>
              <dt>Đã điểm danh</dt>
              <dd>{metrics ? metrics.attendance.present + metrics.attendance.late : "—"}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="dashboard-operations" aria-label="Tình hình vận hành">
        <article className="dashboard-panel dashboard-operations__health">
          <div className="dashboard-panel__heading">
            <div>
              <h2>Tình hình vận hành</h2>
              <p>Sức chứa, đặt chỗ và điểm danh trong kỳ đã chọn.</p>
            </div>
          </div>
          <div className="dashboard-capacity">
            <section>
              <div className="dashboard-capacity__heading">
                <span>Tỷ lệ lấp đầy</span>
                <strong>{formatPercent(metrics?.occupancyRate)}</strong>
              </div>
              <progress aria-label="Tỷ lệ lấp đầy" max="100" value={occupancyRate} />
              <p>{metrics ? `${metrics.bookings} lượt đặt chỗ trên ${metrics.capacity} chỗ đã mở` : "—"}</p>
            </section>
            <section>
              <div className="dashboard-capacity__heading">
                <span>Tỷ lệ điểm danh</span>
                <strong>{formatPercent(metrics?.attendanceRate)}</strong>
              </div>
              <progress aria-label="Tỷ lệ điểm danh" max="100" value={attendanceRate} />
              <p>{metrics ? `${metrics.attendance.marked} lượt đã được ghi nhận` : "—"}</p>
            </section>
          </div>
          <dl className="dashboard-detail-metrics">
            <div><dt>Lớp đã mở</dt><dd>{metrics?.classes ?? "—"}</dd></div>
            <div><dt>Chỗ còn trống</dt><dd>{availableSlots ?? "—"}</dd></div>
            <div><dt>Có mặt</dt><dd>{metrics?.attendance.present ?? "—"}</dd></div>
            <div><dt>Đi trễ / vắng</dt><dd>{metrics ? `${metrics.attendance.late} / ${metrics.attendance.absent}` : "—"}</dd></div>
          </dl>
        </article>

        <nav className="dashboard-panel dashboard-operations__actions" aria-label="Thao tác nhanh">
          <div className="dashboard-panel__heading">
            <div>
              <h2>Thao tác nhanh</h2>
              <p>Đi tới các công việc điều hành thường dùng.</p>
            </div>
          </div>
          <div className="dashboard-action-list">
            <button onClick={() => onNavigate?.("members")} type="button"><UsersRound aria-hidden="true" size={17} /><span>Quản lý hội viên</span><ArrowRight aria-hidden="true" size={16} /></button>
            <button onClick={() => onNavigate?.("classes")} type="button"><CalendarDays aria-hidden="true" size={17} /><span>Quản lý lớp học</span><ArrowRight aria-hidden="true" size={16} /></button>
            <button onClick={() => onNavigate?.("payments")} type="button"><ReceiptText aria-hidden="true" size={17} /><span>Xử lý thanh toán</span><ArrowRight aria-hidden="true" size={16} /></button>
            <button onClick={() => onNavigate?.("reports")} type="button"><ClipboardCheck aria-hidden="true" size={17} /><span>Xem báo cáo chi tiết</span><ArrowRight aria-hidden="true" size={16} /></button>
          </div>
        </nav>
      </section>
    </>
  );
}

function RoleDashboard({ onNavigate, role, summary }) {
  return (
    <section className="dashboard-role">
      <div className="dashboard-role__kpis">
        {(roleKpis[role] ?? []).map((item) => (
          <MetricCard
            icon={item.key === "todayClasses" ? CalendarDays : item.key === "pendingPayments" ? CreditCard : CircleAlert}
            key={item.key}
            label={item.label}
            onClick={item.target ? () => onNavigate?.(item.target) : undefined}
            value={summary?.[item.key] ?? "—"}
          />
        ))}
      </div>
    </section>
  );
}

export function DashboardHome({ onNavigate, role }) {
  const [period, setPeriod] = useState("month");
  const isOperationsLeader = ["admin", "manager"].includes(role);
  const summaryQuery = useQuery({ queryKey: ["dashboard-summary", role, isOperationsLeader ? period : null], queryFn: () => dashboardApi.summary(role, isOperationsLeader ? { period } : {}) });
  const summary = summaryQuery.data ?? null;
  const loading = summaryQuery.isLoading;
  const error = summaryQuery.error?.message ?? "";

  const heading = isOperationsLeader
    ? {
        eyebrow: role === "admin" ? "Quản trị hệ thống" : "Phân tích vận hành",
        title: role === "admin" ? "Toàn cảnh hệ thống" : "Tình hình trung tâm",
      }
    : role === "receptionist"
    ? { eyebrow: "Tổng quan hôm nay", title: "Vận hành tại quầy" }
    : role === "coach"
    ? { eyebrow: "Tổng quan hôm nay", title: "Lịch làm việc của tôi" }
    : { eyebrow: "Tổng quan hôm nay", title: "Hoạt động của tôi" };

  return (
    <section className="dashboard-home">
      <header className="dashboard-home__header">
        <div>
          <p>{heading.eyebrow}</p>
          <h1>{heading.title}</h1>
        </div>
        {isOperationsLeader && (
          <div aria-label="Chọn kỳ báo cáo" className="dashboard-periods">
            {periods.map((item) => (
              <button
                aria-pressed={period === item.id}
                className={period === item.id ? "dashboard-period dashboard-period--active" : "dashboard-period"}
                key={item.id}
                onClick={() => setPeriod(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>
      {error ? (
        <article className="dashboard-error">
          <strong>Không thể tải dashboard.</strong>
          <span>{error}</span>
        </article>
      ) : loading ? (
        <div className="dashboard-skeleton" aria-label="Đang tải số liệu">
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : isOperationsLeader ? (
        <ManagerDashboard onNavigate={onNavigate} summary={summary} />
      ) : (
        <RoleDashboard onNavigate={onNavigate} role={role} summary={summary} />
      )}
    </section>
  );
}
