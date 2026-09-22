import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { Pagination } from "../../components/ui/Pagination.jsx";
import { usePagination } from "../../components/ui/usePagination.js";
import { trainingApi } from "./training-api.js";
import "../members/members.css";

const newPlan = {
  memberId: "",
  templateId: "",
  name: "",
  goal: "",
  startsOn: new Date().toISOString().slice(0, 10),
  endsOn: "",
};
const newTemplate = {
  name: "",
  targetGroup: "",
  description: "",
  exerciseName: "",
  sets: "3",
  reps: "10",
  restSeconds: "60",
};
const newResult = {
  planId: "",
  recordedOn: new Date().toISOString().slice(0, 10),
  metric: "Tiến độ buổi tập",
  valueNumeric: "",
  valueText: "",
  coachComment: "",
};
const createSessionExercise = () => ({ name: "", sets: "3", reps: "10", restSeconds: "60" });
const createSessionForm = () => ({ planId: "", position: "1", title: "", scheduledOn: new Date().toISOString().slice(0, 10), exercises: [createSessionExercise()] });
const planStatusLabels = { active: "Đang áp dụng", completed: "Đã hoàn thành" };

export function TrainingPage({ session }) {
  const [templates, setTemplates] = useState([]);
  const [members, setMembers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [plan, setPlan] = useState(newPlan);
  const [template, setTemplate] = useState(newTemplate);
  const [result, setResult] = useState(newResult);
  const [sessionForm, setSessionForm] = useState(createSessionForm);
  const [sessions, setSessions] = useState([]);
  const [aiDrafts, setAiDrafts] = useState([]);
  const [delivery, setDelivery] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isCoach = session?.user?.role === "coach";
  const canCreateTemplate =
    session?.permissions?.includes("training.template.manage") ?? false;
  const membersById = useMemo(
    () => new Map(members.map((item) => [item.id, item])),
    [members],
  );
  const plansPagination = usePagination(plans);
  const load = useCallback(async () => {
    try {
      const [nextTemplates, nextMembers, nextPlans, nextAiDrafts] = await Promise.all([
        trainingApi.templates(),
        trainingApi.members(),
        trainingApi.plans(),
        isCoach ? trainingApi.aiSuggestions() : Promise.resolve([]),
      ]);
      setTemplates(nextTemplates);
      setMembers(nextMembers);
      setPlans(nextPlans);
      setAiDrafts(nextAiDrafts);
    } catch (caught) {
      setError(caught.message);
    }
  }, [isCoach]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  async function submit(task, success) {
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await task();
      setNotice(success);
      await load();
    } catch (caught) {
      setError(caught.message);
    } finally {
      setSubmitting(false);
    }
  }
  async function loadSessions(planId) { if (!planId) { setSessions([]); return; } try { setSessions(await trainingApi.sessions(planId)); } catch (caught) { setError(caught.message); } }
  async function moveSession(index, direction) { const reordered = [...sessions]; const target = index + direction; if (target < 0 || target >= reordered.length) return; [reordered[index], reordered[target]] = [reordered[target], reordered[index]]; await submit(async () => { await trainingApi.reorderSessions(sessionForm.planId, reordered.map((item) => item.id)); await loadSessions(sessionForm.planId); }, "Đã cập nhật thứ tự buổi tập."); }
  async function moveSessionExercise(sessionItem, index, direction) { const reordered = [...sessionItem.exercises]; const target = index + direction; if (target < 0 || target >= reordered.length) return; [reordered[index], reordered[target]] = [reordered[target], reordered[index]]; await submit(async () => { await trainingApi.reorderSessionExercises(sessionItem.id, reordered.map((item) => item.id)); await loadSessions(sessionForm.planId); }, "Đã cập nhật thứ tự bài tập."); }
  function updateSessionExercise(index, field, value) { setSessionForm((current) => ({ ...current, exercises: current.exercises.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item) })); }
  function memberName(memberId) {
    const member = membersById.get(memberId);
    return member ? (
      <>
        {member.full_name}
        <small>{member.member_code}</small>
      </>
    ) : (
      "Hội viên không còn khả dụng"
    );
  }
  return (
    <main className="members-page">
      <header>
        <p>Giáo án</p>
        <h1>Mẫu và kế hoạch tập luyện</h1>
      </header>
      {error && <p className="auth-alert">{error}</p>}
      {notice && <p className="auth-success">{notice}</p>}
      {isCoach && <section className="members-list"><div className="list-heading"><h2>Gợi ý AI cần Coach duyệt</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{aiDrafts.flatMap((group) => group.suggestions).length === 0 ? <p>Chưa có gợi ý mới.</p> : aiDrafts.flatMap((group) => group.suggestions).map((draft) => <article key={`${draft.subject}-${draft.body}`}><strong>{draft.subject}</strong><p>{draft.body}</p><small>Coach phải tự rà soát, sửa nội dung nếu cần, rồi mới gửi cho hội viên.</small><p><Button disabled={submitting} onClick={() => setDelivery({ memberId: "", subject: draft.subject, body: draft.body })} size="sm" type="button" variant="secondary">Rà soát và gửi</Button></p></article>)}{delivery && <form className="members-form training-action-form" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await trainingApi.deliverAiSuggestion(delivery); setDelivery(null); }, "Coach đã duyệt và gửi hướng dẫn cho hội viên."); }}><h3>Duyệt hướng dẫn trước khi gửi</h3><label>Hội viên<select onChange={(event) => setDelivery({ ...delivery, memberId: event.target.value })} required value={delivery.memberId}><option value="">Chọn hội viên trong phạm vi</option>{members.map((member) => <option key={member.id} value={member.id}>{member.full_name} — {member.member_code}</option>)}</select></label><label>Tiêu đề<input maxLength="160" onChange={(event) => setDelivery({ ...delivery, subject: event.target.value })} required value={delivery.subject} /></label><label>Nội dung<textarea maxLength="1000" onChange={(event) => setDelivery({ ...delivery, body: event.target.value })} required value={delivery.body} /></label><Button loading={submitting} type="submit">Xác nhận gửi cho hội viên</Button> <Button disabled={submitting} onClick={() => setDelivery(null)} type="button" variant="ghost">Hủy</Button></form>}</section>}
      {canCreateTemplate && (
        <form
          className="members-form training-template-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(async () => {
              await trainingApi.createTemplate({
                name: template.name,
                targetGroup: template.targetGroup,
                description: template.description || undefined,
                exercises: [
                  {
                    name: template.exerciseName,
                    sets: Number(template.sets),
                    reps: Number(template.reps),
                    rest_seconds: Number(template.restSeconds),
                  },
                ],
              });
              setTemplate(newTemplate);
            }, "Đã tạo mẫu giáo án chung.");
          }}
        >
          <h2>Tạo mẫu giáo án</h2>
          <label>
            Tên mẫu
            <input
              onChange={(e) =>
                setTemplate({ ...template, name: e.target.value })
              }
              required
              value={template.name}
            />
          </label>
          <label>
            Đối tượng
            <input
              onChange={(e) =>
                setTemplate({ ...template, targetGroup: e.target.value })
              }
              required
              value={template.targetGroup}
            />
          </label>
          <label>
            Bài tập đầu tiên
            <input
              onChange={(e) =>
                setTemplate({ ...template, exerciseName: e.target.value })
              }
              required
              value={template.exerciseName}
            />
          </label>
          <label>
            Số hiệp
            <input
              min="1"
              onChange={(e) =>
                setTemplate({ ...template, sets: e.target.value })
              }
              required
              type="number"
              value={template.sets}
            />
          </label>
          <label>
            Số lần
            <input
              min="1"
              onChange={(e) =>
                setTemplate({ ...template, reps: e.target.value })
              }
              required
              type="number"
              value={template.reps}
            />
          </label>
          <label>
            Nghỉ giữa hiệp (giây)
            <input
              min="0"
              onChange={(e) =>
                setTemplate({ ...template, restSeconds: e.target.value })
              }
              required
              type="number"
              value={template.restSeconds}
            />
          </label>
          <Button loading={submitting} type="submit">
            Tạo mẫu
          </Button>
        </form>
      )}
      <div className="training-action-grid">
        <form
          className="members-form training-action-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(async () => {
              await trainingApi.createPlan(plan);
              setPlan(newPlan);
            }, "Đã tạo giáo án cá nhân.");
          }}
        >
          <div className="training-form-heading">
            <span>01 · Lập kế hoạch</span>
            <h2>Tạo giáo án cá nhân</h2>
          </div>
          <section className="training-field-group">
            <h3>Chọn đầu vào</h3>
            <label>
              Hội viên
              <select
                onChange={(e) => setPlan({ ...plan, memberId: e.target.value })}
                required
                value={plan.memberId}
              >
                <option value="">Chọn hội viên</option>
                {members.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name} — {item.member_code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Mẫu giáo án
              <select
                onChange={(e) =>
                  setPlan({ ...plan, templateId: e.target.value })
                }
                required
                value={plan.templateId}
              >
                <option value="">Chọn mẫu</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
          <section className="training-field-group">
            <h3>Thiết lập kế hoạch</h3>
            <label>
              Tên giáo án
              <input
                onChange={(e) => setPlan({ ...plan, name: e.target.value })}
                required
                value={plan.name}
              />
            </label>
            <label>
              Mục tiêu
              <input
                onChange={(e) => setPlan({ ...plan, goal: e.target.value })}
                required
                value={plan.goal}
              />
            </label>
            <label>
              Bắt đầu
              <input
                onChange={(e) => setPlan({ ...plan, startsOn: e.target.value })}
                required
                type="date"
                value={plan.startsOn}
              />
            </label>
            <label>
              Kết thúc
              <input
                onChange={(e) => setPlan({ ...plan, endsOn: e.target.value })}
                required
                type="date"
                value={plan.endsOn}
              />
            </label>
          </section>
          <Button loading={submitting} type="submit">
            Tạo từ mẫu
          </Button>
        </form>
        <form
          className="members-form training-action-form training-result-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(async () => {
              await trainingApi.recordResult({
                ...result,
                valueNumeric: result.valueNumeric
                  ? Number(result.valueNumeric)
                  : undefined,
                valueText: result.valueText || undefined,
                coachComment: result.coachComment || undefined,
              });
              setResult(newResult);
            }, "Đã ghi nhận kết quả tập luyện.");
          }}
        >
          <div className="training-form-heading">
            <span>02 · Theo dõi tiến độ</span>
            <h2>Ghi nhận kết quả</h2>
          </div>
          <label>
            Giáo án
            <select
              onChange={(e) => setResult({ ...result, planId: e.target.value })}
              required
              value={result.planId}
            >
              <option value="">Chọn giáo án</option>
              {plans
                .filter((item) => item.status === "active")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Ngày ghi nhận
            <input
              onChange={(e) =>
                setResult({ ...result, recordedOn: e.target.value })
              }
              required
              type="date"
              value={result.recordedOn}
            />
          </label>
          <label>
            Chỉ số
            <input
              onChange={(e) => setResult({ ...result, metric: e.target.value })}
              required
              value={result.metric}
            />
          </label>
          <label>
            Giá trị số
            <input
              onChange={(e) =>
                setResult({ ...result, valueNumeric: e.target.value })
              }
              type="number"
              value={result.valueNumeric}
            />
          </label>
          <label>
            Ghi nhận
            <textarea
              onChange={(e) =>
                setResult({ ...result, valueText: e.target.value })
              }
              value={result.valueText}
            />
          </label>
          <label>
            Nhận xét của Coach
            <textarea
              onChange={(e) =>
                setResult({ ...result, coachComment: e.target.value })
              }
              value={result.coachComment}
            />
          </label>
          <Button loading={submitting} type="submit">
            Lưu kết quả
          </Button>
        </form>
        <form className="members-form training-action-form training-session-form" onSubmit={(event) => { event.preventDefault(); void submit(async () => { await trainingApi.createSession(sessionForm.planId, { position: Number(sessionForm.position), title: sessionForm.title, scheduledOn: sessionForm.scheduledOn || undefined, exercises: sessionForm.exercises.map((exercise) => ({ name: exercise.name, sets: Number(exercise.sets), reps: Number(exercise.reps), rest_seconds: Number(exercise.restSeconds) })) }); const selectedPlanId = sessionForm.planId; setSessionForm({ ...createSessionForm(), planId: selectedPlanId }); await loadSessions(selectedPlanId); }, "Đã thêm buổi tập vào lộ trình."); }}>
          <div className="training-form-heading"><span>03 · Lịch buổi tập</span><h2>Thêm và ghi nhận buổi tập</h2></div>
          <label>Giáo án<select onChange={(event) => { const planId = event.target.value; setSessionForm({ ...sessionForm, planId }); void loadSessions(planId); }} required value={sessionForm.planId}><option value="">Chọn giáo án</option>{plans.filter((item) => item.status === "active").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>Thứ tự buổi<input min="1" onChange={(event) => setSessionForm({ ...sessionForm, position: event.target.value })} required type="number" value={sessionForm.position} /></label>
          <label>Nội dung<input onChange={(event) => setSessionForm({ ...sessionForm, title: event.target.value })} required value={sessionForm.title} /></label>
          <label>Ngày dự kiến<input onChange={(event) => setSessionForm({ ...sessionForm, scheduledOn: event.target.value })} type="date" value={sessionForm.scheduledOn} /></label>
          <div className="training-field-group"><h3>Bài tập theo thứ tự</h3>{sessionForm.exercises.map((exercise, index) => <fieldset key={index}><legend>Bài tập {index + 1}</legend><label>Tên bài tập<input onChange={(event) => updateSessionExercise(index, "name", event.target.value)} required value={exercise.name} /></label><label>Số hiệp<input min="1" onChange={(event) => updateSessionExercise(index, "sets", event.target.value)} required type="number" value={exercise.sets} /></label><label>Số lần<input min="1" onChange={(event) => updateSessionExercise(index, "reps", event.target.value)} required type="number" value={exercise.reps} /></label><label>Nghỉ (giây)<input min="0" onChange={(event) => updateSessionExercise(index, "restSeconds", event.target.value)} required type="number" value={exercise.restSeconds} /></label>{sessionForm.exercises.length > 1 && <Button onClick={() => setSessionForm((current) => ({ ...current, exercises: current.exercises.filter((_, itemIndex) => itemIndex !== index) }))} size="sm" type="button" variant="ghost">Xóa bài tập</Button>}</fieldset>)}<Button onClick={() => setSessionForm((current) => ({ ...current, exercises: [...current.exercises, createSessionExercise()] }))} size="sm" type="button" variant="secondary">Thêm bài tập</Button></div>
          <Button loading={submitting} type="submit">Thêm buổi</Button>
          {sessions.length > 0 && <div className="training-field-group"><h3>Buổi đã lên lịch</h3>{sessions.map((item, index) => <article key={item.id}><strong>Buổi {item.position}: {item.title}</strong><p>{item.status === "completed" ? "Đã hoàn thành" : item.status === "skipped" ? "Bỏ buổi" : "Chờ tập"} · {item.scheduled_on ? new Date(item.scheduled_on).toLocaleDateString("vi-VN") : "Chưa đặt ngày"}</p><ol>{item.exercises.map((exercise, exerciseIndex) => <li key={exercise.id}>{exercise.name} · {exercise.sets} hiệp × {exercise.reps ?? "—"} lần <Button disabled={submitting || exerciseIndex === 0} onClick={() => void moveSessionExercise(item, exerciseIndex, -1)} size="sm" type="button" variant="ghost">Lên</Button> <Button disabled={submitting || exerciseIndex === item.exercises.length - 1} onClick={() => void moveSessionExercise(item, exerciseIndex, 1)} size="sm" type="button" variant="ghost">Xuống</Button></li>)}</ol><Button disabled={submitting || index === 0} onClick={() => void moveSession(index, -1)} size="sm" type="button" variant="ghost">Lên buổi</Button> <Button disabled={submitting || index === sessions.length - 1} onClick={() => void moveSession(index, 1)} size="sm" type="button" variant="ghost">Xuống buổi</Button> <Button disabled={submitting || item.status !== "pending"} onClick={() => void submit(async () => { await trainingApi.updateSession(item.id, { status: "completed", coachComment: "Đã hoàn thành buổi tập" }); await loadSessions(sessionForm.planId); }, "Đã ghi nhận buổi tập hoàn thành.")} size="sm" type="button" variant="secondary">Hoàn thành</Button> <Button disabled={submitting || item.status !== "pending"} onClick={() => void submit(async () => { await trainingApi.updateSession(item.id, { status: "skipped", coachComment: "Coach ghi nhận bỏ buổi" }); await loadSessions(sessionForm.planId); }, "Đã ghi nhận bỏ buổi tập.")} size="sm" type="button" variant="ghost">Bỏ buổi</Button></article>)}</div>}
        </form>
      </div>
      <section className="members-list">
        <div className="list-heading">
          <h2>Giáo án</h2>
          <Button onClick={load} size="sm" variant="ghost">
            Tải lại
          </Button>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Mã giáo án</th>
                <th>Tên giáo án</th>
                <th>Hội viên</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {plansPagination.pageItems.map((item) => (
                <tr key={item.id}>
                  <td><code>{item.id}</code></td>
                  <td>{item.name}</td>
                  <td>{memberName(item.member_id)}</td>
                  <td>{planStatusLabels[item.status] ?? item.status}</td>
                  <td>
                    {item.status === "active" && (
                      <Button
                        disabled={submitting}
                        onClick={() =>
                          void submit(
                            () =>
                              trainingApi.updatePlan(item.id, {
                                status: "completed",
                              }),
                            "Đã hoàn thành giáo án.",
                          )
                        }
                        size="sm"
                        variant="secondary"
                      >
                        Hoàn thành
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination {...plansPagination} />
      </section>
    </main>
  );
}
