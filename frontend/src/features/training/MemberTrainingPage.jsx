import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { trainingApi } from "./training-api.js";
import "../members/members.css";

const formatDate = (value) => value ? new Date(value).toLocaleDateString("vi-VN") : "—";

export function MemberTrainingPage() {
  const [progress, setProgress] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { setLoading(true); setError(""); try { setProgress(await trainingApi.mine()); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  return <main className="members-page"><header><p>Giáo án</p><h1>Tiến độ tập luyện của tôi</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}<section className="members-list"><div className="list-heading"><h2>Giáo án</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải giáo án…</p> : progress?.plans.length === 0 ? <p>Coach chưa tạo giáo án cho bạn.</p> : <div className="table-scroll"><table><thead><tr><th>Tên giáo án</th><th>Mục tiêu</th><th>Hiệu lực</th><th>Trạng thái</th></tr></thead><tbody>{progress?.plans.map((plan) => <tr key={plan.id}><td>{plan.name}</td><td>{plan.goal}</td><td>{formatDate(plan.starts_on)} – {formatDate(plan.ends_on)}</td><td>{plan.status}</td></tr>)}</tbody></table></div>}</section><section className="members-list"><h2>Kết quả và nhận xét từ Coach</h2>{loading ? <p>Đang tải kết quả…</p> : progress?.results.length === 0 ? <p>Chưa có kết quả tập luyện được ghi nhận.</p> : <div className="table-scroll"><table><thead><tr><th>Ngày</th><th>Chỉ số</th><th>Giá trị</th><th>Nhận xét</th></tr></thead><tbody>{progress?.results.map((result) => <tr key={result.id}><td>{formatDate(result.recorded_on)}</td><td>{result.metric}</td><td>{result.value_numeric ?? result.value_text ?? "—"}</td><td>{result.coach_comment ?? "—"}</td></tr>)}</tbody></table></div>}</section></main>;
}
