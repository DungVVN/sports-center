import { useQuery } from "@tanstack/react-query";
import { Button } from "../../components/ui/Button.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { trainingApi } from "./training-api.js";
import { errorMessageFor } from "../../api/error-message.js";

const formatDate = (value) => value ? new Date(value).toLocaleDateString("vi-VN") : "—";

export function MemberTrainingPage() {
  const progressQuery = useQuery({ queryKey: ["member", "training"], queryFn: trainingApi.mine });
  const progress = progressQuery.data ?? null;
  const plansPagination = usePagination(progress?.plans ?? []);
  const sessionsPagination = usePagination(progress?.sessions ?? []);
  const resultsPagination = usePagination(progress?.results ?? []);

  const planStatusLabels = { active: "Đang áp dụng", completed: "Đã hoàn thành" };
  const sessionStatusLabels = { pending: "Chờ tập", completed: "Đã hoàn thành", skipped: "Bỏ buổi" };

  return <main className="members-page">
    <header><p>Giáo án</p><h1>Tiến độ tập luyện của tôi</h1></header>
    {progressQuery.isError && <p className="auth-alert" role="alert">{errorMessageFor(progressQuery.error, "Không thể tải tiến độ tập luyện.")}</p>}
    <section className="members-list"><div className="list-heading"><h2>Giáo án đang áp dụng</h2><Button onClick={progressQuery.refetch} size="sm" variant="ghost">Tải lại</Button></div>
      {progressQuery.isLoading ? <p>Đang tải giáo án…</p> : progress?.plans.length === 0 ? <p>Coach chưa tạo giáo án cho bạn.</p> : <><div className="table-scroll"><table><thead><tr><th>Mã giáo án</th><th>Tên giáo án</th><th>Mục tiêu</th><th>Hiệu lực</th><th>Trạng thái</th></tr></thead><tbody>{plansPagination.pageItems.map((plan) => <tr key={plan.id}><td><code>#{plan.id.slice(0, 8)}</code></td><td><strong>{plan.name}</strong></td><td>{plan.goal}</td><td>{formatDate(plan.starts_on)} – {formatDate(plan.ends_on)}</td><td><span className={plan.status === "active" ? "badge badge--success" : "badge"}>{planStatusLabels[plan.status] ?? plan.status}</span></td></tr>)}</tbody></table></div><Pagination {...plansPagination} /></>}
    </section>
    <section className="members-list"><h2>Lịch buổi tập</h2>
      {progressQuery.isLoading ? <p>Đang tải lịch…</p> : progress?.sessions.length === 0 ? <p>Chưa có lịch buổi tập.</p> : <><div className="table-scroll"><table><thead><tr><th>Buổi</th><th>Nội dung</th><th>Ngày dự kiến</th><th>Trạng thái</th><th>Nhận xét Coach</th></tr></thead><tbody>{sessionsPagination.pageItems.map((item) => <tr key={item.id}><td><strong>Buổi {item.position}</strong></td><td>{item.title}</td><td>{formatDate(item.scheduled_on)}</td><td><span className={item.status === "completed" ? "badge badge--success" : item.status === "skipped" ? "badge badge--danger" : "badge badge--warning"}>{sessionStatusLabels[item.status] ?? item.status}</span></td><td>{item.coach_comment ?? "—"}</td></tr>)}</tbody></table></div><Pagination {...sessionsPagination} /></>}
    </section>
    <section className="members-list"><h2>Kết quả tập luyện và nhận xét</h2>
      {progressQuery.isLoading ? <p>Đang tải kết quả…</p> : progress?.results.length === 0 ? <p>Chưa có kết quả tập luyện được ghi nhận.</p> : <><div className="table-scroll"><table><thead><tr><th>Mã kết quả</th><th>Ngày ghi nhận</th><th>Chỉ số</th><th>Giá trị</th><th>Nhận xét của Coach</th></tr></thead><tbody>{resultsPagination.pageItems.map((result) => <tr key={result.id}><td><code>#{result.id.slice(0, 8)}</code></td><td>{formatDate(result.recorded_on)}</td><td><strong>{result.metric}</strong></td><td>{result.value_numeric ?? result.value_text ?? "—"}</td><td>{result.coach_comment ?? "—"}</td></tr>)}</tbody></table></div><Pagination {...resultsPagination} /></>}
    </section>
  </main>;
}
