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
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function change(next) { setDraftState({ key: detailKey, items: next, revision, dirty: true }); setNotice(""); }
  function updateAt(index, patch) { change(items.map((item, position) => position === index ? { ...item, ...patch } : item)); }
  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items]; [next[index], next[target]] = [next[target], next[index]]; change(next);
  }
  function addItem(kind = "link") {
    const item = newMenuItem(kind);
    change([...items, item]);
    setSelectedItemId(item.id);
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

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];
  const selectedIndex = items.findIndex((item) => item.id === selectedItem?.id);

  return <section className="site-admin"><header className="site-admin__header"><div><p className="site-admin__eyebrow">NỘI DUNG WEBSITE / ĐIỀU HƯỚNG</p><h1>Menu website</h1><p>Sắp xếp liên kết công khai theo cây; menu làm việc của nhân viên không thay đổi.</p></div><div className="site-admin__actions"><Button onClick={() => { if (dirty && !window.confirm("Bỏ thay đổi chưa lưu?")) return; setDraftState(null); setSelectedItemId(null); setLocation("header"); }} variant={location === "header" ? "primary" : "secondary"}>Header</Button><Button onClick={() => { if (dirty && !window.confirm("Bỏ thay đổi chưa lưu?")) return; setDraftState(null); setSelectedItemId(null); setLocation("footer"); }} variant={location === "footer" ? "primary" : "secondary"}>Footer</Button></div></header>
    {notice && <p className="site-admin__notice" role="status">{notice}</p>}{error && <p className="site-admin__error" role="alert">{error}</p>}
    {query.isPending ? <p role="status">Đang tải menu...</p> : query.isError ? <p role="alert">{errorMessageFor(query.error, "Không tải được menu.")}</p> : <>
      <div className="site-admin__panel site-admin__toolbar"><div><p className="site-admin__eyebrow">SƠ ĐỒ ĐIỀU HƯỚNG</p><h2>{location === "header" ? "Menu đầu trang" : "Liên kết chân trang"}</h2><p>{items.length} mục cấp 1 · {detail.published ? "Đã có bản công khai" : "Chưa xuất bản"}{detail.draft ? " · Có bản nháp" : ""}{dirty ? " · Chưa lưu" : ""}</p></div><div className="site-admin__actions"><Button onClick={() => setPreview((value) => !value)} variant="outline">{preview ? "Đóng xem trước" : "Xem trước"}</Button><Button disabled={!dirty || working} onClick={save} variant="secondary">Lưu nháp</Button><Button disabled={dirty || !revision || !hasVisibleLink(items) || working} onClick={publish}>Xuất bản</Button></div></div>
      <p className="site-admin__workflow-note">Chỉ menu đã xuất bản mới có thể xuất hiện trên website khi CMS công khai được bật. Lưu nháp không đổi điều hướng hiện tại.</p>
      {preview && <nav className="site-admin__panel site-admin__menu-preview" aria-label="Xem trước menu nháp">{items.filter((item) => item.active).map((item) => <span key={item.id}>{item.label}{item.children.length > 0 && <small>{item.children.filter((child) => child.active).map((child) => child.label).join(" · ")}</small>}</span>)}</nav>}
      <div className="site-admin__builder site-admin__builder--menu"><div className="site-admin__panel site-admin__menu-tree"><div className="site-admin__subhead"><div><p className="site-admin__eyebrow">CÂY MENU</p><h3>{location === "header" ? "Header" : "Footer"}</h3></div><span className="site-admin__status">Bản đang sửa</span></div><p className="site-admin__canvas-help">Chọn một mục để sửa bên cạnh. Nhóm có thể chứa tối đa 12 liên kết con.</p><div className="site-admin__menu-root">{location === "header" ? "Đầu trang" : "Chân trang"}</div><div className="site-admin__menu-branches">{items.map((item, index) => <div className="site-admin__menu-branch" key={item.id}><button className={`site-admin__menu-node${selectedItem?.id === item.id ? " is-selected" : ""}`} type="button" onClick={() => setSelectedItemId(item.id)} aria-pressed={selectedItem?.id === item.id}><strong>{index + 1}. {item.label}</strong><small>{item.kind === "group" ? `${item.children.length} mục con` : item.href || "Chưa có đường dẫn"}{item.active ? "" : " · Đang ẩn"}</small></button>{item.children.length > 0 && <div className="site-admin__menu-children">{item.children.map((child) => <span key={child.id}>{child.label}{child.active ? "" : " · Đang ẩn"}</span>)}</div>}</div>)}</div>{items.length === 0 && <div className="site-admin__empty"><strong>Menu chưa có liên kết</strong><p>Thêm liên kết hoặc nhóm để bắt đầu.</p></div>}<div className="site-admin__actions"><Button disabled={items.length >= 20} onClick={() => addItem()} size="sm" variant="outline">Thêm liên kết</Button><Button disabled={items.length >= 20} onClick={() => addItem("group")} size="sm" variant="outline">Thêm nhóm</Button></div></div>
        <aside className="site-admin__panel site-admin__inspector" aria-label="Bảng chỉnh sửa mục menu"><div className="site-admin__subhead"><div><p className="site-admin__eyebrow">BẢNG CHỈNH SỬA</p><h3>{selectedItem?.label ?? "Chọn một mục"}</h3></div></div>{selectedItem ? <MenuItemEditor item={selectedItem} index={selectedIndex} onChange={(patch) => updateAt(selectedIndex, patch)} onMove={(direction) => move(selectedIndex, direction)} onRemove={() => { change(items.filter((_, position) => position !== selectedIndex)); setSelectedItemId(null); }} /> : <p className="site-admin__muted">Chọn mục trong cây menu để chỉnh nhãn, đường dẫn và trạng thái hiển thị.</p>}</aside></div>
      {detail.revisions.length > 0 && <div className="site-admin__panel"><h3>Lịch sử phiên bản</h3><ul className="site-admin__history">{detail.revisions.map((entry) => <li key={entry.id}>Bản {entry.versionNumber} · {entry.status === "draft" ? "Nháp" : "Đã xuất bản"}{entry.status === "published" && entry.id !== detail.published?.id && <Button disabled={working} onClick={() => restore(entry.id)} size="sm" variant="outline">Chọn lại bản này</Button>}</li>)}</ul></div>}
    </>}
  </section>;
}
