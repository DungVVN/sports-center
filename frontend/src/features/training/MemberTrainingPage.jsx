import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { trainingApi } from "./training-api.js";
import "../members/members.css";

const formatDate = (value) => value ? new Date(value).toLocaleDateString("vi-VN") : "—";

export function MemberTrainingPage() {
  const [progress, setProgress] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const plansPagination = usePagination(progress?.plans ?? []);
  const resultsPagination = usePagination(progress?.results ?? []);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setProgress(await trainingApi.mine()); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <main className="members-page"><header><p>Giáo án</p><h1>Tiến độ tập luyện của tôi</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}<section className="members-list"><div className="list-heading"><h2>Giáo án đang áp dụng</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải giáo án…</p> : progress?.plans.length === 0 ? <p>Coach chưa tạo giáo án cho bạn.</p> : <><div className="table-scroll"><table><thead><tr><th>Mã giáo án</th><th>Tên giáo án</th><th>Mục tiêu</th><th>Hiệu lực</th><th>Trạng thái</th></tr></thead><tbody>{plansPagination.pageItems.map((plan) => <tr key={plan.id}><td><code>{plan.id}</code></td><td>{plan.name}</td><td>{plan.goal}</td><td>{formatDate(plan.starts_on)} – {formatDate(plan.ends_on)}</td><td>{plan.status}</td></tr>)}</tbody></table></div><Pagination {...plansPagination} /></>}</section><section className="members-list"><h2>Kết quả tập luyện và nhận xét</h2>{loading ? <p>Đang tải kết quả…</p> : progress?.results.length === 0 ? <p>Chưa có kết quả tập luyện được ghi nhận.</p> : <><div className="table-scroll"><table><thead><tr><th>Mã kết quả</th><th>Ngày ghi nhận</th><th>Chỉ số</th><th>Giá trị</th><th>Nhận xét của Coach</th></tr></thead><tbody>{resultsPagination.pageItems.map((result) => <tr key={result.id}><td><code>{result.id}</code></td><td>{formatDate(result.recorded_on)}</td><td>{result.metric}</td><td>{result.value_numeric ?? result.value_text ?? "—"}</td><td>{result.coach_comment ?? "—"}</td></tr>)}</tbody></table></div><Pagination {...resultsPagination} /></>}</section></main>;
}
