import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { Dialog } from "../../components/ui/Dialog.jsx";
import { classApi } from "./class-api.js";
import "../members/members.css";

const emptyChange = { classId: "", type: "cancel", startsAt: "", endsAt: "", reason: "" };
const emptyClass = { name: "", type: "group", description: "", coachUserId: "", roomId: "", startsAt: "", endsAt: "", capacity: "" };
const statusLabels = { draft: "Nháp", published: "Đã công bố", cancelled: "Đã hủy", completed: "Hoàn thành" };
function toDateTimeInput(value) { return value ? new Date(value).toISOString().slice(0, 16) : ""; }

export function ClassesPage({ session }) {
  const [classes, setClasses] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [changeForm, setChangeForm] = useState(emptyChange);
  const [classForm, setClassForm] = useState(emptyClass);
  const [editingClass, setEditingClass] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const role = session?.user?.role;
  const canManage = ["manager", "receptionist"].includes(role);
  const canReview = role === "receptionist";
  const ownClasses = useMemo(() => role === "coach" ? classes.filter((item) => item.coach_user_id === session?.user?.id) : classes, [classes, role, session?.user?.id]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const base = await Promise.all([classApi.list(), classApi.rooms(), classApi.coaches()]);
      setClasses(base[0]); setRooms(base[1]); setCoaches(base[2]);
      if (canReview) setRequests(await classApi.changeRequests()); else setRequests([]);
    } catch (caught) { setError(caught.message); }
    finally { setLoading(false); }
  }, [canReview]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  function updateChange(event) { setChangeForm((value) => ({ ...value, [event.target.name]: event.target.value })); }
  function updateClass(event) { setClassForm((value) => ({ ...value, [event.target.name]: event.target.value })); }

  async function createClass(event) {
    event.preventDefault(); setError(""); setNotice(""); setSubmitting(true);
    try {
      await classApi.create({ ...classForm, capacity: Number(classForm.capacity), startsAt: new Date(classForm.startsAt).toISOString(), endsAt: new Date(classForm.endsAt).toISOString() });
      setClassForm(emptyClass); setNotice("Đã tạo lớp nháp. Hãy rà soát rồi công bố lớp."); await load();
    } catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  async function publish(id) {
    setError(""); setNotice(""); setSubmitting(true);
    try { await classApi.publish(id); setNotice("Đã công bố lớp học."); await load(); }
    catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  function openEdit(item) { setEditingClass({ id: item.id, name: item.name, type: item.type, description: item.description ?? "", coachUserId: item.coach_user_id, roomId: item.room_id, startsAt: toDateTimeInput(item.starts_at), endsAt: toDateTimeInput(item.ends_at), capacity: String(item.capacity) }); }
  async function updateClassSession(event) {
    event.preventDefault(); if (!editingClass) return; setError(""); setNotice(""); setSubmitting(true);
    try { const { id, ...input } = editingClass; await classApi.update(id, { ...input, capacity: Number(input.capacity), startsAt: new Date(input.startsAt).toISOString(), endsAt: new Date(input.endsAt).toISOString() }); setEditingClass(null); setNotice("Đã cập nhật thông tin lớp học."); await load(); }
    catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  async function submitChange(event) {
    event.preventDefault(); setError(""); setNotice(""); setSubmitting(true);
    try {
      await classApi.requestChange(changeForm.classId, { type: changeForm.type, reason: changeForm.reason, ...(changeForm.type === "reschedule" ? { startsAt: new Date(changeForm.startsAt).toISOString(), endsAt: new Date(changeForm.endsAt).toISOString() } : {}) });
      setChangeForm(emptyChange); setNotice("Đã gửi yêu cầu để Lễ tân duyệt.");
    } catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  async function review(id, approved) {
    setError(""); setNotice(""); setSubmitting(true);
    try { await classApi.reviewChange(id, approved); setNotice(approved ? "Đã duyệt thay đổi lớp và gửi thông báo cho hội viên." : "Đã từ chối yêu cầu thay đổi lớp."); await load(); }
    catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  return <main className="members-page"><header><p>Lớp học</p><h1>Lịch lớp</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}
    <div className="members-grid">{canManage ? <form className="members-form" onSubmit={createClass}><h2>Tạo lớp học</h2><label>Tên lớp<input name="name" onChange={updateClass} required value={classForm.name} /></label><label>Loại lớp<input name="type" onChange={updateClass} required value={classForm.type} /></label><label>Coach<select name="coachUserId" onChange={updateClass} required value={classForm.coachUserId}><option value="">Chọn Coach</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.display_name}</option>)}</select></label><label>Phòng<select name="roomId" onChange={updateClass} required value={classForm.roomId}><option value="">Chọn phòng</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name} · {room.capacity} chỗ</option>)}</select></label><label>Bắt đầu<input name="startsAt" onChange={updateClass} required type="datetime-local" value={classForm.startsAt} /></label><label>Kết thúc<input name="endsAt" onChange={updateClass} required type="datetime-local" value={classForm.endsAt} /></label><label>Sức chứa<input min="1" name="capacity" onChange={updateClass} required type="number" value={classForm.capacity} /></label><label>Mô tả<textarea name="description" onChange={updateClass} value={classForm.description} /></label><Button loading={submitting} type="submit">Tạo lớp nháp</Button></form> : <form className="members-form" onSubmit={submitChange}><h2>Đề xuất thay đổi</h2><label>Lớp phụ trách<select name="classId" onChange={updateChange} required value={changeForm.classId}><option value="">Chọn lớp</option>{ownClasses.filter((item) => item.status === "published").map((item) => <option key={item.id} value={item.id}>{item.name} · {new Date(item.starts_at).toLocaleString("vi-VN")}</option>)}</select></label><label>Loại<select name="type" onChange={updateChange} value={changeForm.type}><option value="cancel">Hủy lớp</option><option value="reschedule">Đổi lịch</option></select></label>{changeForm.type === "reschedule" && <><label>Bắt đầu mới<input name="startsAt" onChange={updateChange} required type="datetime-local" value={changeForm.startsAt} /></label><label>Kết thúc mới<input name="endsAt" onChange={updateChange} required type="datetime-local" value={changeForm.endsAt} /></label></>}<label>Lý do<textarea minLength="3" name="reason" onChange={updateChange} required value={changeForm.reason} /></label><Button loading={submitting} type="submit">Gửi Lễ tân duyệt</Button></form>}
      <section className="members-list"><div className="list-heading"><h2>{canReview ? "Yêu cầu chờ duyệt" : "Hướng dẫn"}</h2><Button onClick={load} size="sm" variant="ghost">Tải lại</Button></div>{canReview ? requests.length === 0 ? <p>Không có yêu cầu chờ duyệt.</p> : requests.map((item) => <article className="change-request" key={item.id}><strong>{item.type === "cancel" ? "Hủy lớp" : "Đổi lịch"}</strong><p>{item.reason}</p><Button disabled={submitting} onClick={() => review(item.id, true)} size="sm">Duyệt</Button> <Button disabled={submitting} onClick={() => review(item.id, false)} size="sm" variant="danger">Từ chối</Button></article>) : <p>Coach gửi đề xuất hủy hoặc đổi lịch. Lễ tân duyệt, hệ thống sẽ thông báo hội viên và hủy booking cũ để hội viên đặt lại.</p>}</section>
    </div>
    <section className="members-list"><div className="list-heading"><h2>{role === "coach" ? "Lớp tôi phụ trách" : "Lớp học"}</h2></div>{loading ? <p>Đang tải…</p> : ownClasses.length === 0 ? <p>Chưa có lớp học.</p> : <div className="table-scroll"><table><thead><tr><th>Tên lớp</th><th>Bắt đầu</th><th>Sức chứa</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{ownClasses.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.type}</small></td><td>{new Date(item.starts_at).toLocaleString("vi-VN")}</td><td>{item.capacity}</td><td>{statusLabels[item.status] ?? item.status}</td><td>{canManage && <><Button disabled={submitting} onClick={() => openEdit(item)} size="sm" variant="ghost">Sửa</Button>{item.status === "draft" && <Button disabled={submitting} onClick={() => publish(item.id)} size="sm" variant="secondary">Công bố</Button>}</>}</td></tr>)}</tbody></table></div>}</section><Dialog isOpen={Boolean(editingClass)} onClose={() => setEditingClass(null)} title="Chỉnh sửa lớp học">{editingClass && <form className="members-form" onSubmit={updateClassSession}><label>Tên lớp<input name="name" onChange={(event) => setEditingClass({ ...editingClass, [event.target.name]: event.target.value })} required value={editingClass.name} /></label><label>Loại lớp<input name="type" onChange={(event) => setEditingClass({ ...editingClass, [event.target.name]: event.target.value })} required value={editingClass.type} /></label><label>Coach<select name="coachUserId" onChange={(event) => setEditingClass({ ...editingClass, [event.target.name]: event.target.value })} required value={editingClass.coachUserId}><option value="">Chọn Coach</option>{coaches.map((coach) => <option key={coach.id} value={coach.id}>{coach.display_name}</option>)}</select></label><label>Phòng<select name="roomId" onChange={(event) => setEditingClass({ ...editingClass, [event.target.name]: event.target.value })} required value={editingClass.roomId}><option value="">Chọn phòng</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label><label>Bắt đầu<input name="startsAt" onChange={(event) => setEditingClass({ ...editingClass, [event.target.name]: event.target.value })} required type="datetime-local" value={editingClass.startsAt} /></label><label>Kết thúc<input name="endsAt" onChange={(event) => setEditingClass({ ...editingClass, [event.target.name]: event.target.value })} required type="datetime-local" value={editingClass.endsAt} /></label><label>Sức chứa<input min="1" name="capacity" onChange={(event) => setEditingClass({ ...editingClass, [event.target.name]: event.target.value })} required type="number" value={editingClass.capacity} /></label><label>Mô tả<textarea name="description" onChange={(event) => setEditingClass({ ...editingClass, [event.target.name]: event.target.value })} value={editingClass.description} /></label><Button loading={submitting} type="submit">Lưu thay đổi</Button></form>}</Dialog>
  </main>;
}
