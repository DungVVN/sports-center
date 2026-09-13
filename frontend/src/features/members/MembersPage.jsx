import { useEffect, useMemo, useState } from "react";
import { ApiError } from "../../api/api-error.js";
import { Button } from "../../components/ui/Button.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { classApi } from "../classes/class-api.js";
import { memberApi } from "./member-api.js";
import "./members.css";

const emptyMember = { fullName: "", email: "", phone: "" };
const emptyAssignment = { coachUserId: "", effectiveFrom: new Date().toISOString().slice(0, 10), reason: "" };

function displayError(caught, fallback) { return caught instanceof ApiError ? caught.message : fallback; }

export function MembersPage() {
  const [members, setMembers] = useState([]);
  const [memberForm, setMemberForm] = useState(emptyMember);
  const [coaches, setCoaches] = useState([]);
  const [assignment, setAssignment] = useState(emptyAssignment);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const coachNames = useMemo(() => new Map(coaches.map((coach) => [coach.id, coach.display_name])), [coaches]);

  async function load() {
    setLoading(true);
    try { setMembers(await memberApi.list()); }
    catch (caught) { setError(displayError(caught, "Không thể tải danh sách hội viên.")); }
    finally { setLoading(false); }
  }

  useEffect(() => { void Promise.resolve().then(load); }, []);

  function updateMember(event) { setMemberForm((value) => ({ ...value, [event.target.name]: event.target.value })); }
  function updateAssignment(event) { setAssignment((value) => ({ ...value, [event.target.name]: event.target.value })); }

  async function create(event) {
    event.preventDefault(); setError(""); setNotice("");
    try { const created = await memberApi.create(memberForm); setMembers((items) => [created, ...items]); setMemberForm(emptyMember); setNotice("Đã tạo hồ sơ hội viên."); }
    catch (caught) { setError(displayError(caught, "Không thể tạo hội viên.")); }
  }

  async function openAssignment(member) {
    setError(""); setSelectedMember(member); setAssignment(emptyAssignment); setAssignmentHistory([]); setAssignmentLoading(true);
    try {
      const [availableCoaches, history] = await Promise.all([classApi.coaches(), memberApi.coachAssignments(member.id)]);
      setCoaches(availableCoaches); setAssignmentHistory(history);
    } catch (caught) { setError(displayError(caught, "Không thể tải Coach hoặc lịch sử phân công.")); }
    finally { setAssignmentLoading(false); }
  }

  function closeAssignment() { if (!assignmentLoading) setSelectedMember(null); }

  async function submitAssignment(event) {
    event.preventDefault();
    if (!selectedMember) return;
    if (!assignment.coachUserId) { setError("Hãy chọn Coach phụ trách."); return; }
    setAssignmentLoading(true); setError(""); setNotice("");
    try {
      await memberApi.assignCoach(selectedMember.id, assignment);
      setNotice(`Đã cập nhật Coach chính cho ${selectedMember.fullName}.`);
      setSelectedMember(null);
    } catch (caught) { setError(displayError(caught, "Không thể phân công Coach.")); }
    finally { setAssignmentLoading(false); }
  }

  return <main className="members-page"><header><p>Hội viên</p><h1>Quản lý hội viên</h1></header>
    {error && <p className="auth-alert" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}
    <section className="members-grid"><form className="members-form" onSubmit={create}><h2>Thêm hội viên</h2><label>Họ tên<input name="fullName" onChange={updateMember} required value={memberForm.fullName} /></label><label>Email<input name="email" onChange={updateMember} type="email" value={memberForm.email} /></label><label>Số điện thoại<input name="phone" onChange={updateMember} required value={memberForm.phone} /></label><Button type="submit">Tạo hội viên</Button></form>
      <section className="members-list"><div className="list-heading"><h2>Danh sách hội viên</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{loading ? <p>Đang tải…</p> : members.length === 0 ? <p>Chưa có hội viên.</p> : <div className="table-scroll"><table><thead><tr><th>Hội viên</th><th>Liên hệ</th><th>Mã hội viên</th><th>Coach chính</th></tr></thead><tbody>{members.map((item) => <tr key={item.id}><td><strong>{item.fullName}</strong><small>{item.email ?? "Chưa có email"}</small></td><td>{item.phone}</td><td><code>{item.memberCode}</code></td><td><Button onClick={() => openAssignment(item)} size="sm" variant="ghost">Phân công</Button></td></tr>)}</tbody></table></div>}</section>
    </section>
    <Dialog isOpen={Boolean(selectedMember)} onClose={closeAssignment} title="Phân công Coach chính"><form onSubmit={submitAssignment}><div className="dialog__body"><p className="dialog__helper">Phân công mới sẽ lưu lịch sử Coach cũ theo ngày hiệu lực. Coach cũ chỉ còn xem dữ liệu của hội viên trong khoảng từng phụ trách.</p><label>Hội viên<input disabled value={selectedMember?.fullName ?? ""} /></label><label>Coach phụ trách<select disabled={assignmentLoading} name="coachUserId" onChange={updateAssignment} required value={assignment.coachUserId}><option value="">Chọn Coach</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.display_name} — {coach.email}</option>)}</select></label><label>Ngày hiệu lực<input disabled={assignmentLoading} name="effectiveFrom" onChange={updateAssignment} required type="date" value={assignment.effectiveFrom} /></label><label>Lý do<input disabled={assignmentLoading} maxLength="500" name="reason" onChange={updateAssignment} placeholder="Ví dụ: điều chỉnh lịch tập" value={assignment.reason} /></label>{assignmentHistory.length > 0 && <section className="assignment-history"><h3>Lịch sử phân công</h3><ul>{assignmentHistory.map((item) => <li key={item.id}><strong>{coachNames.get(item.coach_user_id) ?? "Coach đã lưu"}</strong><span>{new Date(item.effective_from).toLocaleDateString("vi-VN")} — {item.effective_to ? new Date(item.effective_to).toLocaleDateString("vi-VN") : "hiện tại"}</span></li>)}</ul></section>}</div><div className="dialog__actions"><Button disabled={assignmentLoading} onClick={closeAssignment} type="button" variant="secondary">Hủy</Button><Button loading={assignmentLoading} type="submit">Lưu phân công</Button></div></form></Dialog>
  </main>;
}
