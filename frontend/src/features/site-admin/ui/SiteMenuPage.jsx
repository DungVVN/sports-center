import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../shared/ui/Button.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { siteAdminApi } from "../api/site-admin-api.js";
import { MenuItemEditor } from "./MenuItemEditor.jsx";
import { SiteMenuTree } from "./SiteMenuTree.jsx";
import { useMenuDraftState } from "./useMenuDraftState.js";
import "./site-admin.css";

const hasVisibleLink = (items) => items.some((item) => item.active && (item.kind === "link" || hasVisibleLink(item.children)));

export function SiteMenuPage() {
  const client = useQueryClient();
  const [location, setLocation] = useState("header");
  const query = useQuery({ queryKey: ["site-admin-menu", location], queryFn: () => siteAdminApi.menu(location) });
  const detail = query.data;

  const draft = useMenuDraftState(detail, location);

  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function changeLocation(next) {
    if (next === location) return;
    if (draft.dirty && !window.confirm("Bỏ thay đổi chưa lưu?")) return;
    draft.clearDraft();
    setPreview(false);
    setLocation(next);
    setError("");
    setNotice("");
  }

  async function action(work, success) {
    setWorking(true); setError(""); setNotice("");
    try {
      const result = await work();
      await client.invalidateQueries({ queryKey: ["site-admin-menu", location] });
      setNotice(success);
      return result;
    }
    catch (cause) { setError(errorMessageFor(cause, "Không thể hoàn tất thao tác.")); return null; }
    finally { setWorking(false); }
  }

  async function save() {
    const saved = await action(() => siteAdminApi.saveMenuDraft(location, { editRevision: draft.revision, items: draft.items }), "Đã lưu menu nháp. Website công khai chưa thay đổi.");
    if (saved) draft.clearDraft();
  }

  async function publish() {
    if (draft.dirty || draft.revision === 0 || !window.confirm(`Xuất bản menu ${location === "header" ? "đầu trang" : "chân trang"}?`)) return;
    const result = await action(() => siteAdminApi.publishMenu(location, draft.revision), "Đã xuất bản menu.");
    if (result) draft.clearDraft();
  }

  async function restore(revisionId) {
    if (!window.confirm("Chọn lại phiên bản menu này?")) return;
    await action(() => siteAdminApi.restoreMenu(location, revisionId), "Đã khôi phục menu công khai.");
  }

  const selectedItem = draft.items.find((item) => item.id === draft.selectedItemId);
  const selectedIndex = draft.items.findIndex((item) => item.id === draft.selectedItemId);

  return (
    <section className="site-admin site-admin--menu">
      <header className="site-admin__menu-heading site-admin__panel">
        <div>
          <p className="site-admin__eyebrow">THIẾT LẬP / MENU WEBSITE</p>
          <h1>Menu & điều hướng website</h1>
        </div>
        <div className="site-admin__actions">
          <div className="site-admin__menu-tabs" role="group" aria-label="Vị trí menu">
            <button className={location === "header" ? "is-active" : ""} onClick={() => changeLocation("header")} type="button">Header Menu</button>
            <button className={location === "footer" ? "is-active" : ""} onClick={() => changeLocation("footer")} type="button">Footer Links</button>
          </div>
          <Button onClick={() => setPreview((value) => !value)} variant="outline">{preview ? "Đóng preview" : "Mở preview"}</Button>
        </div>
      </header>

      {notice && <p className="site-admin__notice" role="status">{notice}</p>}
      {error && <p className="site-admin__error" role="alert">{error}</p>}

      {query.isPending ? (
        <p role="status">Đang tải menu...</p>
      ) : query.isError ? (
        <p role="alert">{errorMessageFor(query.error, "Không tải được menu.")}</p>
      ) : (
        <>
          <div className="site-admin__menu-actionbar">
            <div>
              <strong>{location === "header" ? "Menu đầu trang" : "Liên kết chân trang"}</strong>
              <span>
                {detail.published ? "Đã có bản công khai" : "Chưa xuất bản"} · {detail.draft ? "Có bản nháp" : "Chưa có bản nháp"}{draft.dirty ? " · Chưa lưu" : ""}
              </span>
            </div>
            <div className="site-admin__actions">
              <Button disabled={!draft.dirty || working} onClick={save} variant="secondary">Lưu nháp</Button>
              <Button disabled={draft.dirty || !draft.revision || !hasVisibleLink(draft.items) || working} onClick={publish}>Xuất bản</Button>
            </div>
          </div>
          <p className="site-admin__workflow-note">
            Lưu nháp không đổi điều hướng hiện tại. Website chỉ dùng menu đã xuất bản khi CMS công khai được bật.
          </p>

          {preview && (
            <nav className="site-admin__panel site-admin__menu-preview" aria-label="Xem trước menu nháp">
              {draft.items.filter((item) => item.active).map((item) => (
                <span key={item.id}>
                  {item.label}
                  {item.children.length > 0 && <small>{item.children.filter((child) => child.active).map((child) => child.label).join(" · ")}</small>}
                </span>
              ))}
            </nav>
          )}

          <div className="site-admin__builder site-admin__builder--menu">
            <div className="site-admin__menu-workspace">
              <SiteMenuTree
                items={draft.items}
                location={location}
                selectedId={draft.selectedItemId}
                onSelect={draft.setSelectedItemId}
                onAddRoot={() => draft.addItem()}
              />
            </div>

            <div className="site-admin__inspector">
              {selectedItem ? (
                <aside className="site-admin__panel site-admin__menu-inspector" aria-label="Bảng chỉnh sửa mục menu">
                  <div className="site-admin__subhead">
                    <div>
                      <p className="site-admin__eyebrow">CHỈNH SỬA NODE</p>
                      <h3>{selectedItem.label}</h3>
                    </div>
                    <button type="button" className="site-admin__sheet-close" onClick={() => draft.setSelectedItemId(null)} aria-label="Đóng bảng chỉnh sửa">×</button>
                  </div>
                  <MenuItemEditor
                    item={selectedItem}
                    index={selectedIndex}
                    onChange={(patch) => draft.updateAt(selectedIndex, patch)}
                    onMove={(direction) => draft.move(selectedIndex, direction)}
                    onRemove={() => draft.removeItem(selectedIndex)}
                  />
                  <Button disabled={draft.items.length >= 20} onClick={() => draft.addItem("group")} size="sm" variant="outline">Thêm nhóm cấp 1</Button>
                </aside>
              ) : (
                <aside className="site-admin__panel site-admin__empty" aria-label="Hướng dẫn Inspector">
                  <p>Chọn một mục bên cây thư mục để chỉnh sửa hoặc nhấn "Thêm mục cấp 1".</p>
                </aside>
              )}
            </div>
          </div>

          {detail.revisions.length > 0 && (
            <details className="site-admin__panel site-admin__history-panel">
              <summary>Lịch sử phiên bản menu</summary>
              <ul className="site-admin__history">
                {detail.revisions.map((entry) => (
                  <li key={entry.id}>
                    Bản {entry.versionNumber} · {entry.status === "draft" ? "Nháp" : "Đã xuất bản"}
                    {entry.status === "published" && entry.id !== detail.published?.id && (
                      <Button disabled={working} onClick={() => restore(entry.id)} size="sm" variant="outline">Chọn lại bản này</Button>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
