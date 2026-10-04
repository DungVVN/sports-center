import { useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";
import { usePersonalizationWorkspace } from "../api/usePersonalizationWorkspace.js";
import { personalizationApi } from "../api/personalization-api.js";
import { PrescriptionDetails } from "./PrescriptionDetails.jsx";

function MemberCheckin({ sessions, run, pending }) {
  return <form className="members-form training-action-form" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); void run(() => personalizationApi.checkin(data.session, { sessionDate: data.date, availableMinutes: Number(data.minutes), ...(data.sleep ? { sleepHours: Number(data.sleep) } : {}), ...(data.fatigue ? { fatigueScore: Number(data.fatigue) } : {}), ...(data.discomfort ? { discomfortScore: Number(data.discomfort) } : {}), newSymptoms: data.symptoms === "yes", notes: data.notes, otherActivity: data.activity })); }}>
    <h3>Thể trạng trước buổi tập</h3><p>Khi có triệu chứng mới, hệ thống giữ trạng thái cần xử lý chuyên môn. Không tự tăng tải từ check-in.</p>
    <label>Buổi tập<select name="session" required><option value="">Chọn buổi</option>{sessions.map((id) => <option key={id} value={id}>#{id.slice(0, 8)}</option>)}</select></label><label>Ngày<input name="date" type="date" required /></label><label>Thời gian có thể tập (phút)<input name="minutes" type="number" min="1" max="1440" required /></label>
    <label>Đã ngủ (giờ)<input name="sleep" type="number" min="0" max="24" step="0.5" /></label><label>Mệt mỏi tự đánh giá (0–10)<input name="fatigue" type="number" min="0" max="10" /></label><label>Khó chịu tự đánh giá (0–10)<input name="discomfort" type="number" min="0" max="10" /></label>
    <label>Có triệu chứng mới?<select name="symptoms" required><option value="">Chọn câu trả lời</option><option value="no">Không</option><option value="yes">Có</option></select></label><label>Mô tả cần HLV biết<textarea name="notes" maxLength={1000} /></label><label>Hoạt động ngoài trung tâm<textarea name="activity" maxLength={1000} /></label><Button type="submit" loading={pending}>Gửi check-in</Button></form>;
}

export function MemberPersonalization() {
  const workspace = usePersonalizationWorkspace(undefined, true);
  const [assessmentAcknowledged, setAssessmentAcknowledged] = useState(false);
  const [nutritionAcknowledged, setNutritionAcknowledged] = useState(false);
  const profile = workspace.profile.data;
  const pending = workspace.mutation.isPending;
  const run = async (task) => { try { return await workspace.mutation.mutateAsync(task); } catch { return null; } };
  const assessmentConsent = profile?.consents.find((item) => item.purpose === "assessment" && !item.withdrawn_at);
  const nutritionConsent = profile?.consents.find((item) => item.purpose === "nutrition_tracking" && !item.withdrawn_at);
  const sessions = [...new Set((profile?.decisions ?? []).flatMap((item) => item.prescriptions.map((p) => p.training_session_id)))];
  return <section className="members-list training-personalization"><h2>Hồ sơ tập luyện cá nhân</h2><p>HLV được phân công sử dụng thông tin thể trạng, số đo và lịch của bạn để đánh giá và lập giáo án. Bạn có thể rút đồng ý; việc tạo/duyệt giáo án mới sẽ dừng. Hồ sơ đã ghi được giữ để đối chiếu lịch sử và truy vết. Nhật ký dinh dưỡng có đồng ý riêng.</p>
    {workspace.error && <p role="alert" className="auth-alert">{workspace.error}</p>}{workspace.notice && <p role="status">{workspace.notice}</p>}<Button variant="ghost" onClick={() => void workspace.profile.refetch()}>Tải lại hồ sơ cá nhân</Button>
    {workspace.profile.isLoading && <p>Đang tải hồ sơ cá nhân…</p>}
    {profile && <>
      {assessmentConsent ? <p>Đã đồng ý đánh giá. <Button loading={pending} onClick={() => void run(() => personalizationApi.withdraw(assessmentConsent.id))}>Rút đồng ý đánh giá</Button></p> : <div><label><input type="checkbox" checked={assessmentAcknowledged} onChange={(e) => setAssessmentAcknowledged(e.target.checked)} />Tôi đã đọc và đồng ý sử dụng thông tin để đánh giá tập luyện (training-privacy-v1).</label><Button disabled={!assessmentAcknowledged} loading={pending} onClick={() => void run(() => personalizationApi.consent("assessment"))}>Đồng ý đánh giá</Button></div>}
      {!profile.decisions.length && <p>Chưa có giáo án cá nhân được duyệt.</p>}{profile.decisions.map((item) => <article key={item.id}><h3>{item.protocol.name}</h3><PrescriptionDetails decision={item} /></article>)}
      {sessions.length > 0 && <details><summary>Gửi check-in trước buổi tập</summary><MemberCheckin sessions={sessions} run={run} pending={pending} /></details>}
      {profile.checkins.map((item) => <p key={item.id}>Check-in {String(item.session_date).slice(0, 10)}: {item.new_symptoms || item.review_status === "hold" ? "Tạm dừng, liên hệ HLV để xử lý" : item.review_status === "reviewed" ? "HLV đã xem" : "Chờ HLV xem"}</p>)}
      <details><summary>Nhật ký năng lượng tự ghi</summary><p>Ghi số liệu từ nhật ký/phương pháp đã dùng. Hệ thống chưa tính BMR/TDEE hoặc đưa mục tiêu calo; số liệu thiết bị là ước tính nên chưa được nhận làm số đo đã xác minh.</p>
        {nutritionConsent ? <Button loading={pending} onClick={() => void run(() => personalizationApi.withdraw(nutritionConsent.id))}>Rút đồng ý nhật ký dinh dưỡng</Button> : <div><label><input type="checkbox" checked={nutritionAcknowledged} onChange={(e) => setNutritionAcknowledged(e.target.checked)} />Tôi đồng ý lưu nhật ký năng lượng riêng.</label><Button disabled={!nutritionAcknowledged} loading={pending} onClick={() => void run(() => personalizationApi.consent("nutrition_tracking"))}>Đồng ý nhật ký</Button></div>}
        {nutritionConsent && <form className="members-form training-action-form" onSubmit={(event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); void run(() => personalizationApi.energy({ recordedOn: data.date, energyType: data.type, valueKcal: Number(data.value), dataKind: "self_reported", method: data.method, includesExercise: data.includes === "on" })); }}><label>Ngày<input name="date" type="date" required /></label><label>Loại năng lượng<select name="type"><option value="intake">Ăn/uống đã ghi</option><option value="resting">Tiêu hao lúc nghỉ đã đo</option><option value="exercise">Tiêu hao vận động đã đo</option><option value="total_daily">Tổng tiêu hao ngày đã đo</option></select></label><label>Giá trị (kcal)<input type="number" name="value" min="0.01" step="any" required /></label><label>Phương pháp và nguồn số liệu<textarea name="method" required /></label><label><input name="includes" type="checkbox" />Tổng tiêu hao ngày đã bao gồm vận động</label><Button type="submit" loading={pending}>Lưu nhật ký tự báo</Button></form>}
        {profile.energy.map((item) => <p key={item.id}>{String(item.recorded_on).slice(0, 10)}: {item.value_kcal} kcal · {item.energy_type} · tự báo · {item.method}</p>)}
      </details>
      <details><summary>Kết quả đã được ghi nhận</summary>{profile.observations.map((item) => <p key={item.id}>{item.metric_code}: {item.value_numeric ?? item.value_text} {item.unit} · {item.data_kind} · {item.method}</p>)}</details>
      <details><summary>Chỉ tiêu cá nhân và phương pháp đánh giá</summary>{profile.assessments.flatMap((assessment) => assessment.goals).map((goal) => <p key={goal.id}>{goal.metric_code}: mục tiêu {goal.target_numeric ?? goal.target_text} {goal.unit} · đánh giá ngày {String(goal.due_on).slice(0, 10)} bằng {goal.evaluation_method}. Đây là mục tiêu được thống nhất, chưa phải kết quả đã đạt.</p>)}</details>
    </>}
  </section>;
}
