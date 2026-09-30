import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../shared/ui/Button.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { SiteBlockView } from "../../site/index.js";
import { siteAdminApi } from "../api/site-admin-api.js";
import { BlockEditor } from "./BlockEditor.jsx";
import { blockNames, newBlock } from "./editor-model.js";
import "./site-admin.css";

const toForm = (revision) => ({ title: revision.title, seoTitle: revision.seo_title, seoDescription: revision.seo_description, blocks: revision.blocks, editRevision: revision.edit_revision });

export function SitePagesPage() {
  const client = useQueryClient();
  const pagesQuery = useQuery({ queryKey: ["site-admin-pages"], queryFn: siteAdminApi.pages });
  const pages = pagesQuery.data ?? [];
  const [selected, setSelected] = useState("home");
  const detailQuery = useQuery({ queryKey: ["site-admin-page", selected], queryFn: () => siteAdminApi.page(selected), enabled: pages.some((page) => page.route_key === selected), retry: false });
  const detail = detailQuery.data;
  const [formState, setFormState] = useState(null);
  const detailKey = detail ? `${selected}:${detail.draft?.id ?? "none"}:${detail.draft?.edit_revision ?? 0}` : "";
  const form = formState?.key === detailKey ? formState.form : detail?.draft ? toForm(detail.draft) : null;
  const dirty = formState?.key === detailKey && formState.dirty;
  const [preview, setPreview] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState({ routeKey: "", path: "", title: "" });
  const [showCreate, setShowCreate] = useState(false);

  function change(patch) { setFormState({ key: detailKey, form: { ...form, ...patch }, dirty: true }); setNotice(""); }
  function updateBlock(id, patch) { change({ blocks: form.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) }); }
  function moveBlock(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= form.blocks.length) return;
    const blocks = [...form.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    change({ blocks });
  }
  async function action(work, success) {
    setWorking(true); setError(""); setNotice("");
    try { const result = await work(); await Promise.all([client.invalidateQueries({ queryKey: ["site-admin-pages"] }), client.invalidateQueries({ queryKey: ["site-admin-page", selected] })]); setNotice(success); return result; }
    catch (cause) { setError(errorMessageFor(cause, "Không thể hoàn tất thao tác.")); return null; }
    finally { setWorking(false); }
  }
  async function create(input) {
    const result = await action(() => siteAdminApi.createPage(input), "Đã tạo trang và bản nháp đầu tiên.");
    if (result) { setSelected(input.routeKey); setShowCreate(false); setCreateForm({ routeKey: "", path: "", title: "" }); setFormState(null); }
  }
  async function startDraft() {
    const result = await action(() => siteAdminApi.startPageDraft(selected), "Đã tạo bản nháp. Website công khai chưa thay đổi.");
    if (result) setFormState(null);
  }
  async function save() {
    if (!form) return;
    const result = await action(() => siteAdminApi.savePageDraft(selected, form), "Đã lưu bản nháp. Chưa xuất bản.");
    if (result) setFormState(null);
  }
  async function publish() {
    if (!form || dirty || !window.confirm("Xuất bản nội dung này lên website công khai?")) return;
    const result = await action(() => siteAdminApi.publishPage(selected, form.editRevision), "Đã xuất bản trang.");
    if (result) setFormState(null);
  }
  async function restore(revisionId) {
    if (!window.confirm("Chọn lại phiên bản này làm nội dung công khai?")) return;
    await action(() => siteAdminApi.restorePage(selected, revisionId), "Đã chọn lại phiên bản công khai.");
  }

  if (pagesQuery.isPending) return <p role="status">Đang tải danh sách trang...</p>;
  if (pagesQuery.isError) return <p role="alert">{errorMessageFor(pagesQuery.error, "Không tải được danh sách trang.")}</p>;
  return <section className="site-admin">
    <header className="site-admin__header"><div><p className="site-admin__eyebrow">QUẢN TRỊ WEBSITE</p><h1>Trang website</h1><p>Lưu nháp và xem trước trước khi chủ động xuất bản.</p></div><Button onClick={() => setShowCreate((value) => !value)} variant="secondary">Tạo trang</Button></header>
    {notice && <p className="site-admin__notice" role="status">{notice}</p>}
    {error && <p className="site-admin__error" role="alert">{error}</p>}
    {showCreate && <form className="site-admin__panel site-admin__create" onSubmit={(event) => { event.preventDefault(); void create({ ...createForm, kind: "static" }); }}>
      <label>Khóa route<input required maxLength={80} pattern="[a-z][a-z0-9_-]*" value={createForm.routeKey} onChange={(event) => setCreateForm({ ...createForm, routeKey: event.target.value })} placeholder="gioi-thieu" /></label>
      <label>Đường dẫn<input required value={createForm.path} onChange={(event) => setCreateForm({ ...createForm, path: event.target.value })} placeholder="/gioi-thieu" /></label>
      <label>Tiêu đề<input required value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} /></label>
      <Button disabled={working} type="submit">Tạo bản nháp</Button>
    </form>}
    {!pages.some((page) => page.route_key === "home") && <div className="site-admin__panel"><p>Trang chủ chưa có bản quản trị. Website vẫn hiển thị nội dung hiện tại.</p><Button disabled={working} onClick={() => create({ routeKey: "home", path: "/", kind: "home", title: "Trang chủ" })}>Khởi tạo bản nháp trang chủ</Button></div>}
    {pages.length > 0 && <div className="site-admin__layout"><aside className="site-admin__panel site-admin__sidebar" aria-label="Danh sách trang">{pages.map((page) => <button className={selected === page.route_key ? "is-active" : ""} key={page.id} onClick={() => { if (dirty && !window.confirm("Bỏ thay đổi chưa lưu?")) return; setFormState(null); setPreview(false); setSelected(page.route_key); setError(""); setNotice(""); }} type="button"><strong>{page.route_key === "home" ? "Trang chủ" : page.route_key}</strong><small>{page.path}</small></button>)}</aside>
      <div className="site-admin__main">{detailQuery.isPending ? <p role="status">Đang tải trang...</p> : detailQuery.isError ? <p role="alert">{errorMessageFor(detailQuery.error, "Không tải được trang.")}</p> : detail && <>
        <div className="site-admin__panel site-admin__toolbar"><div><h2>{detail.page.path}</h2><p>{detail.published ? "Đã có bản công khai" : "Chưa xuất bản"}{detail.draft ? " · Có bản nháp" : " · Không có bản nháp"}{dirty ? " · Chưa lưu" : ""}</p></div><div className="site-admin__actions"><Button onClick={() => setPreview((value) => !value)} variant="outline">{preview ? "Đóng xem trước" : "Xem trước"}</Button>{!detail.draft && <Button disabled={working} onClick={startDraft}>Tạo bản nháp</Button>}{form && <><Button disabled={!dirty || working} onClick={save} variant="secondary">Lưu nháp</Button><Button disabled={dirty || working || !form.blocks.some((block) => block.active)} onClick={publish}>Xuất bản</Button></>}</div></div>
        {preview && <div className="site-admin__panel"><h3>Xem trước bản nháp</h3><SiteBlockView blocks={form?.blocks ?? detail.published?.blocks ?? []} /></div>}
        {form && <div className="site-admin__panel site-admin__editor"><label>Tiêu đề trang<input maxLength={240} value={form.title} onChange={(event) => change({ title: event.target.value })} /></label><div className="site-admin__cols"><label>SEO title<input maxLength={240} value={form.seoTitle} onChange={(event) => change({ seoTitle: event.target.value })} /></label><label>SEO description<input maxLength={500} value={form.seoDescription} onChange={(event) => change({ seoDescription: event.target.value })} /></label></div>
          <div className="site-admin__subhead"><h3>Các khối nội dung</h3><select aria-label="Thêm khối" defaultValue="" onChange={(event) => { if (event.target.value) change({ blocks: [...form.blocks, newBlock(event.target.value)] }); event.target.value = ""; }}><option value="">+ Thêm khối</option>{Object.entries(blockNames).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          {form.blocks.map((block, index) => <BlockEditor block={block} index={index} key={block.id} onChange={(patch) => updateBlock(block.id, patch)} onMove={(delta) => moveBlock(index, delta)} onRemove={() => { if (window.confirm("Xóa khối này khỏi bản nháp?")) change({ blocks: form.blocks.filter((item) => item.id !== block.id) }); }} />)}
        </div>}
        {detail.revisions.length > 0 && <div className="site-admin__panel"><h3>Lịch sử phiên bản</h3><ul className="site-admin__history">{detail.revisions.map((revision) => <li key={revision.id}>Bản {revision.versionNumber} · {revision.status === "draft" ? "Nháp" : "Đã xuất bản"}{revision.status === "published" && revision.id !== detail.published?.id && <Button disabled={working} onClick={() => restore(revision.id)} size="sm" variant="outline">Chọn lại bản này</Button>}</li>)}</ul></div>}
      </>}</div></div>}
  </section>;
}
