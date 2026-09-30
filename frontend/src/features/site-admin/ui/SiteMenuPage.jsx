import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../shared/ui/Button.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { siteAdminApi } from "../api/site-admin-api.js";
import { MenuItemEditor } from "./MenuItemEditor.jsx";
import { newMenuItem } from "./editor-model.js";
import "./site-admin.css";

const hasVisibleLink = (items) => items.some((item) => item.active && (item.kind === "link" || hasVisibleLink(item.children)));

export function SiteMenuPage() {
  const client = useQueryClient();
  const [location, setLocation] = useState("header");
  const query = useQuery({ queryKey: ["site-admin-menu", location], queryFn: () => siteAdminApi.menu(location) });
  const detail = query.data;
  const [draftState, setDraftState] = useState(null);
  const detailKey = detail ? `${location}:${detail.draft?.id ?? "none"}:${detail.draft?.edit_revision ?? 0}:${detail.published?.id ?? "none"}` : "";
  const items = draftState?.key === detailKey ? draftState.items : detail?.draft?.items ?? detail?.published?.items ?? [];
  const revision = draftState?.key === detailKey ? draftState.revision : detail?.draft?.edit_revision ?? 0;
  const dirty = draftState?.key === detailKey && draftState.dirty;
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function change(next) { setDraftState({ key: detailKey, items: next, revision, dirty: true }); setNotice(""); }
  function updateAt(index, patch) { change(items.map((item, position) => position === index ? { ...item, ...patch } : item)); }
  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; change(next);
  }
  async function action(work, success) {
    setWorking(true); setError(""); setNotice("");
    try { const result = await work(); await client.invalidateQueries({ queryKey: ["site-admin-menu", location] }); setNotice(success); return result; }
    catch (cause) { setError(errorMessageFor(cause, "Không thể hoàn tất thao tác.")); return null; }
    finally { setWorking(false); }
  }
  async function save() {
    const saved = await action(() => siteAdminApi.saveMenuDraft(location, { editRevision: revision, items }), "Đã lưu menu nháp. Website công khai chưa thay đổi.");
    if (saved) setDraftState(null);
  }
  async function publish() {
    if (dirty || revision === 0 || !window.confirm(`Xuất bản menu ${location === "header" ? "đầu trang" : "chân trang"}?`)) return;
    const result = await action(() => siteAdminApi.publishMenu(location, revision), "Đã xuất bản menu.");
    if (result) setDraftState(null);
  }
  async function restore(revisionId) {
    if (!window.confirm("Chọn lại phiên bản menu này?")) return;
    await action(() => siteAdminApi.restoreMenu(location, revisionId), "Đã khôi phục menu công khai.");
  }

  return <section className="site-admin"><header className="site-admin__header"><div><p className="site-admin__eyebrow">QUẢN TRỊ WEBSITE</p><h1>Menu website</h1><p>Chỉ thay đổi header/footer công khai, không ảnh hưởng menu làm việc của nhân viên.</p></div><div className="site-admin__actions"><Button onClick={() => { if (dirty && !window.confirm("Bỏ thay đổi chưa lưu?")) return; setDraftState(null); setLocation("header"); }} variant={location === "header" ? "primary" : "secondary"}>Header</Button><Button onClick={() => { if (dirty && !window.confirm("Bỏ thay đổi chưa lưu?")) return; setDraftState(null); setLocation("footer"); }} variant={location === "footer" ? "primary" : "secondary"}>Footer</Button></div></header>
    {notice && <p className="site-admin__notice" role="status">{notice}</p>}{error && <p className="site-admin__error" role="alert">{error}</p>}
    {query.isPending ? <p role="status">Đang tải menu...</p> : query.isError ? <p role="alert">{errorMessageFor(query.error, "Không tải được menu.")}</p> : <>
      <div className="site-admin__panel site-admin__toolbar"><div><h2>{location === "header" ? "Menu đầu trang" : "Liên kết chân trang"}</h2><p>{detail.published ? "Đã có bản công khai" : "Chưa xuất bản"}{detail.draft ? " · Có bản nháp" : ""}{dirty ? " · Chưa lưu" : ""}</p></div><div className="site-admin__actions"><Button onClick={() => setPreview((value) => !value)} variant="outline">{preview ? "Đóng xem trước" : "Xem trước"}</Button><Button disabled={!dirty || working} onClick={save} variant="secondary">Lưu nháp</Button><Button disabled={dirty || !revision || !hasVisibleLink(items) || working} onClick={publish}>Xuất bản</Button></div></div>
      {preview && <nav className="site-admin__panel site-admin__menu-preview" aria-label="Xem trước menu nháp">{items.filter((item) => item.active).map((item) => <span key={item.id}>{item.label}{item.children.length > 0 && <small>{item.children.filter((child) => child.active).map((child) => child.label).join(" · ")}</small>}</span>)}</nav>}
      <div className="site-admin__panel site-admin__editor"><div className="site-admin__subhead"><h3>Mục menu</h3><div className="site-admin__actions"><Button disabled={items.length >= 20} onClick={() => change([...items, newMenuItem()])} size="sm" variant="outline">Thêm liên kết</Button><Button disabled={items.length >= 20} onClick={() => change([...items, newMenuItem("group")])} size="sm" variant="outline">Thêm nhóm</Button></div></div>
        {items.map((item, index) => <MenuItemEditor item={item} index={index} key={item.id} onChange={(patch) => updateAt(index, patch)} onMove={(direction) => move(index, direction)} onRemove={() => change(items.filter((_, position) => position !== index))} />)}
      </div>
      {detail.revisions.length > 0 && <div className="site-admin__panel"><h3>Lịch sử phiên bản</h3><ul className="site-admin__history">{detail.revisions.map((entry) => <li key={entry.id}>Bản {entry.versionNumber} · {entry.status === "draft" ? "Nháp" : "Đã xuất bản"}{entry.status === "published" && entry.id !== detail.published?.id && <Button disabled={working} onClick={() => restore(entry.id)} size="sm" variant="outline">Chọn lại bản này</Button>}</li>)}</ul></div>}
    </>}
  </section>;
}
