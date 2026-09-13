import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/Button.jsx";
import { memberApi } from "../members/member-api.js";
import { membershipApi } from "../memberships/membership-api.js";
import { paymentApi } from "./payment-api.js";
import "../members/members.css";

const emptyForm = { memberId: "", membershipId: "", amountVnd: "", method: "cash", provider: "vnpay", notes: "" };
const paymentStatus = { pending: "Chờ xác nhận", paid: "Đã thanh toán", failed: "Thất bại", refunded: "Đã hoàn tiền" };
const methodLabel = { cash: "Tiền mặt", bank_transfer: "Chuyển khoản", online: "Cổng thanh toán" };

export function PaymentsPage() {
  const [items, setItems] = useState([]); const [members, setMembers] = useState([]); const [memberships, setMemberships] = useState([]);
  const [form, setForm] = useState(emptyForm); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false);
  const load = useCallback(async (memberId) => { setLoading(true); try { setItems(await paymentApi.list(memberId)); } catch (caught) { setError(caught.message); } finally { setLoading(false); } }, []);
  useEffect(() => { void Promise.resolve().then(async () => { try { setMembers(await memberApi.list()); } catch (caught) { setError(caught.message); } await load(); }); }, [load]);

  async function selectMember(memberId) {
    setForm((value) => ({ ...value, memberId, membershipId: "", amountVnd: "" })); setMemberships([]); setError("");
    if (!memberId) { await load(); return; }
    try { const [nextMemberships] = await Promise.all([membershipApi.byMember(memberId), load(memberId)]); setMemberships(nextMemberships.filter((item) => item.status === "pending_payment")); }
    catch (caught) { setError(caught.message); }
  }

  function selectMembership(membershipId) { const membership = memberships.find((item) => item.id === membershipId); setForm((value) => ({ ...value, membershipId, amountVnd: membership ? String(membership.priceVnd) : value.amountVnd })); }
  function updateForm(event) { setForm((value) => ({ ...value, [event.target.name]: event.target.value })); }

  async function create(event) {
    event.preventDefault(); setError(""); setNotice(""); setSubmitting(true);
    try { await paymentApi.create({ ...form, membershipId: form.membershipId || undefined, amountVnd: Number(form.amountVnd), provider: form.method === "online" ? form.provider : form.method === "bank_transfer" ? "bank" : undefined }); setForm(emptyForm); setMemberships([]); setNotice(form.method === "online" ? "Đã tạo giao dịch online, chờ callback đã ký từ cổng thanh toán." : "Đã tạo giao dịch chờ Lễ tân xác nhận."); await load(); }
    catch (caught) { setError(caught.message); }
    finally { setSubmitting(false); }
  }

  async function confirm(id, status) { setError(""); setNotice(""); setSubmitting(true); try { await paymentApi.confirm(id, status); setNotice(status === "paid" ? "Đã xác nhận thanh toán và kích hoạt gói tập." : "Đã ghi nhận giao dịch không thành công."); await load(form.memberId || undefined); } catch (caught) { setError(caught.message); } finally { setSubmitting(false); } }

  return <main className="members-page"><header><p>Thanh toán</p><h1>Giao dịch và kích hoạt gói</h1></header>{error && <p className="auth-alert" role="alert">{error}</p>}{notice && <p className="auth-success" role="status">{notice}</p>}<div className="members-grid"><form className="members-form" onSubmit={create}><h2>Tạo giao dịch</h2><label>Hội viên<select onChange={(event) => void selectMember(event.target.value)} required value={form.memberId}><option value="">Chọn hội viên</option>{members.map((member) => <option key={member.id} value={member.id}>{member.fullName} — {member.memberCode}</option>)}</select></label><label>Gói chờ thanh toán<select disabled={!form.memberId} onChange={(event) => selectMembership(event.target.value)} value={form.membershipId}><option value="">Không gắn gói tập</option>{memberships.map((membership) => <option key={membership.id} value={membership.id}>{membership.package_name_snapshot} — {Number(membership.priceVnd).toLocaleString("vi-VN")} ₫</option>)}</select></label><label>Số tiền (VNĐ)<input min="1" name="amountVnd" onChange={updateForm} required type="number" value={form.amountVnd} /></label><label>Phương thức<select name="method" onChange={updateForm} value={form.method}><option value="cash">Tiền mặt</option><option value="bank_transfer">Chuyển khoản</option><option value="online">Cổng thanh toán</option></select></label>{form.method === "online" && <label>Cổng thanh toán<select name="provider" onChange={updateForm} value={form.provider}><option value="vnpay">VNPay</option><option value="momo">MoMo</option><option value="zalopay">ZaloPay</option></select></label>}<label>Ghi chú<textarea name="notes" onChange={updateForm} value={form.notes} /></label><Button loading={submitting} type="submit">Tạo giao dịch</Button></form><section className="members-list"><div className="list-heading"><h2>Giao dịch</h2><Button onClick={() => load(form.memberId || undefined)} size="sm" variant="ghost">Tải lại</Button></div><p>Tiền mặt/chuyển khoản do Lễ tân xác nhận. Giao dịch online chờ webhook đã ký từ VNPay, MoMo hoặc ZaloPay.</p>{loading ? <p>Đang tải…</p> : items.length === 0 ? <p>Chưa có giao dịch.</p> : <div className="table-scroll"><table><thead><tr><th>Mã</th><th>Số tiền</th><th>Phương thức</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><code>{item.transaction_code}</code></td><td>{Number(item.amountVnd).toLocaleString("vi-VN")} ₫</td><td>{item.provider ?? methodLabel[item.method] ?? item.method}</td><td>{paymentStatus[item.status] ?? item.status}</td><td>{item.status === "pending" && item.method !== "online" && <><Button disabled={submitting} onClick={() => confirm(item.id, "paid")} size="sm">Xác nhận</Button> <Button disabled={submitting} onClick={() => confirm(item.id, "failed")} size="sm" variant="danger">Thất bại</Button></>}</td></tr>)}</tbody></table></div>}</section></div></main>;
}
