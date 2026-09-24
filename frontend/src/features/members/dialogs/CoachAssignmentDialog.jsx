import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/Button.jsx";
import { Dialog } from "../../../components/ui/Dialog.jsx";

const emptyAssignment = { coachUserId: "", effectiveFrom: new Date().toISOString().slice(0, 10), reason: "" };

export function CoachAssignmentDialog({ coaches, history, loading, member, onClose, onSubmit }) {
  const [assignment, setAssignment] = useState(emptyAssignment);
  const coachNames = useMemo(() => new Map(coaches.map((coach) => [coach.id, coach.display_name])), [coaches]);
  const close = () => { if (!loading) onClose(); };
  const submit = (event) => { event.preventDefault(); if (assignment.coachUserId) onSubmit(assignment).then(() => setAssignment(emptyAssignment)); };
  return <Dialog isOpen={Boolean(member)} onClose={close} title="Phân công Coach chính"><form onSubmit={submit}><div className="dialog__body">
    <label>Hội viên<input disabled value={member?.fullName ?? ""} /></label><label>Coach phụ trách<select disabled={loading} onChange={(event) => setAssignment((current) => ({ ...current, coachUserId: event.target.value }))} required value={assignment.coachUserId}><option value="">Chọn Coach</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.display_name} — {coach.email}</option>)}</select></label><label>Ngày hiệu lực<input disabled={loading} onChange={(event) => setAssignment((current) => ({ ...current, effectiveFrom: event.target.value }))} required type="date" value={assignment.effectiveFrom} /></label><label>Lý do<input disabled={loading} maxLength="500" onChange={(event) => setAssignment((current) => ({ ...current, reason: event.target.value }))} placeholder="Ví dụ: điều chỉnh lịch tập" value={assignment.reason} /></label>
    {history.length > 0 && <section className="assignment-history"><h3>Lịch sử phân công</h3><ul>{history.map((item) => <li key={item.id}><strong>{coachNames.get(item.coach_user_id) ?? "Coach đã lưu"}</strong><span>{new Date(item.effective_from).toLocaleDateString("vi-VN")} — {item.effective_to ? new Date(item.effective_to).toLocaleDateString("vi-VN") : "hiện tại"}</span></li>)}</ul></section>}
  </div><div className="dialog__actions"><Button disabled={loading} onClick={close} type="button" variant="secondary">Hủy</Button><Button loading={loading} type="submit">Lưu phân công</Button></div></form></Dialog>;
}
