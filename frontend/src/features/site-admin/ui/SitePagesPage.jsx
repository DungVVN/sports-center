import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../../shared/ui/Button.jsx";
import { errorMessageFor } from "../../../shared/api/error-message.js";
import { SiteBlockView } from "../../site/index.js";
import { siteAdminApi } from "../api/site-admin-api.js";
import { BlockEditor } from "./BlockEditor.jsx";
import { blockDescriptions, blockNames, newBlock } from "./editor-model.js";
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
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const librarySearchRef = useRef(null);
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [createForm, setCreateForm] = useState({ routeKey: "", path: "", title: "" });
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!libraryOpen) return undefined;
    librarySearchRef.current?.focus();
    const closeOnEscape = (event) => { if (event.key === "Escape") setLibraryOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [libraryOpen]);

  function change(patch) { setFormState({ key: detailKey, form: { ...form, ...patch }, dirty: true }); setNotice(""); }
  function updateBlock(id, patch) { change({ blocks: form.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) }); }
  function moveBlock(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= form.blocks.length) return;
    const blocks = [...form.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    change({ blocks });
  }
  function addBlock(type) {
    if (!form || form.blocks.length >= 30) return;
    const next = newBlock(type);
    change({ blocks: [...form.blocks, next] });
    setSelectedBlockId(next.id);
    setLibraryOpen(false);
    setLibrarySearch("");
  }
  function removeBlock(id) {
    if (!window.confirm("Xóa khối này khỏi bản nháp?")) return;
    change({ blocks: form.blocks.filter((block) => block.id !== id) });
    if (selectedBlockId === id) setSelectedBlockId(null);
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

  const selectedBlock = form?.blocks.find((block) => block.id === selectedBlockId) ?? form?.blocks[0];
  const selectedIndex = form?.blocks.findIndex((block) => block.id === selectedBlock?.id) ?? -1;
  const libraryEntries = Object.entries(blockNames).filter(([type, name]) => `${name} ${blockDescriptions[type]}`.toLocaleLowerCase("vi").includes(librarySearch.toLocaleLowerCase("vi")));

  if (pagesQuery.isPending) return <p role="status">Đang tải danh sách trang...</p>;
  if (pagesQuery.isError) return <p role="alert">{errorMessageFor(pagesQuery.error, "Không tải được danh sách trang.")}</p>;
  return <section className="site-admin">
    <header className="site-admin__header"><div><p className="site-admin__eyebrow">NỘI DUNG WEBSITE / TRANG</p><h1>Trang website</h1><p>Chọn trang, sắp xếp các phần và xem bố cục trước khi xuất bản.</p></div><Button onClick={() => setShowCreate((value) => !value)} variant="secondary">Tạo trang</Button></header>
    {notice && <p className="site-admin__notice" role="status">{notice}</p>}
    {error && <p className="site-admin__error" role="alert">{error}</p>}
    {showCreate && <form className="site-admin__panel site-admin__create" onSubmit={(event) => { event.preventDefault(); void create({ ...createForm, kind: "static" }); }}>
      <label>Khóa route<input required maxLength={80} pattern="[a-z][a-z0-9_-]*" value={createForm.routeKey} onChange={(event) => setCreateForm({ ...createForm, routeKey: event.target.value })} placeholder="gioi-thieu" /></label>
      <label>Đường dẫn<input required value={createForm.path} onChange={(event) => setCreateForm({ ...createForm, path: event.target.value })} placeholder="/gioi-thieu" /></label>
      <label>Tiêu đề<input required value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} /></label>
      <Button disabled={working} type="submit">Tạo bản nháp</Button>
    </form>}
    {!pages.some((page) => page.route_key === "home") && <div className="site-admin__panel"><p>Trang chủ chưa có bản quản trị. Website vẫn hiển thị nội dung hiện tại.</p><Button disabled={working} onClick={() => create({ routeKey: "home", path: "/", kind: "home", title: "Trang chủ" })}>Khởi tạo bản nháp trang chủ</Button></div>}
    {pages.length > 0 && <div className="site-admin__layout"><aside className="site-admin__panel site-admin__sidebar" aria-label="Danh sách trang"><div className="site-admin__sidebar-heading"><strong>Danh mục trang</strong><span>{pages.length} trang</span></div>{pages.map((page) => <button className={selected === page.route_key ? "is-active" : ""} key={page.id} onClick={() => { if (dirty && !window.confirm("Bỏ thay đổi chưa lưu?")) return; setFormState(null); setPreview(false); setLibraryOpen(false); setSelectedBlockId(null); setSelected(page.route_key); setError(""); setNotice(""); }} type="button"><strong>{page.route_key === "home" ? "Trang chủ" : page.route_key}</strong><small>{page.path}</small></button>)}</aside>
      <div className="site-admin__main">{detailQuery.isPending ? <p role="status">Đang tải trang...</p> : detailQuery.isError ? <p role="alert">{errorMessageFor(detailQuery.error, "Không tải được trang.")}</p> : detail && <>
        <div className="site-admin__panel site-admin__toolbar"><div><p className="site-admin__eyebrow">BỐ CỤC TRANG</p><h2>{selected === "home" ? "Trang chủ" : form?.title ?? detail.published?.title ?? detail.page.path}</h2><p>{detail.page.path} · {detail.published ? "Đã có bản công khai" : "Chưa xuất bản"} · {detail.draft ? "Có bản nháp" : "Không có bản nháp"}{dirty ? " · Chưa lưu" : ""}</p></div><div className="site-admin__actions">{form && <Button disabled={form.blocks.length >= 30} onClick={() => setLibraryOpen(true)} variant="outline">+ Thêm phần</Button>}<Button onClick={() => setPreview((value) => !value)} variant="outline">{preview ? "Đóng xem trước" : "Xem trước"}</Button>{!detail.draft && <Button disabled={working} onClick={startDraft}>Tạo bản nháp</Button>}{form && <><Button disabled={!dirty || working} onClick={save} variant="secondary">Lưu nháp</Button><Button disabled={dirty || working || !form.blocks.some((block) => block.active)} onClick={publish}>Xuất bản</Button></>}</div></div>
        <p className="site-admin__workflow-note">Bản đang sửa chỉ nằm trong CMS. Lưu nháp không thay đổi website; bạn chủ động bấm Xuất bản sau khi kiểm tra.</p>
        {preview && <div className="site-admin__panel site-admin__full-preview"><div className="site-admin__subhead"><div><p className="site-admin__eyebrow">XEM TRƯỚC</p><h3>Bản đang sửa</h3></div><Button onClick={() => setPreview(false)} variant="outline">Đóng</Button></div><SiteBlockView blocks={form?.blocks ?? detail.published?.blocks ?? []} /></div>}
        {form && <>
          <div className="site-admin__panel site-admin__page-settings"><div className="site-admin__subhead"><div><p className="site-admin__eyebrow">THÔNG TIN TRANG</p><h3>Tiêu đề và tìm kiếm</h3></div><span>Chỉnh thông tin trang trước khi xuất bản</span></div><label>Tiêu đề trang<input maxLength={240} value={form.title} onChange={(event) => change({ title: event.target.value })} /></label><div className="site-admin__cols"><label>SEO title<input maxLength={240} value={form.seoTitle} onChange={(event) => change({ seoTitle: event.target.value })} /></label><label>SEO description<input maxLength={500} value={form.seoDescription} onChange={(event) => change({ seoDescription: event.target.value })} /></label></div></div>
          <div className="site-admin__builder"><div className="site-admin__panel site-admin__canvas"><div className="site-admin__subhead"><div><p className="site-admin__eyebrow">BẢN XEM BỐ CỤC</p><h3>{form.blocks.length} phần trên trang</h3></div><span className="site-admin__status">Bản đang sửa</span></div><p className="site-admin__canvas-help">Chọn một phần để sửa nội dung bên cạnh. Bản xem này dùng kiểu hiển thị CMS của Sports Center, chưa thay thế giao diện cũ.</p>{form.blocks.length === 0 ? <div className="site-admin__empty"><strong>Trang chưa có phần nội dung</strong><p>Thêm phần mở đầu, ảnh, nội dung hoặc lời kêu gọi hành động để bắt đầu.</p><Button onClick={() => setLibraryOpen(true)} variant="outline">+ Thêm phần</Button></div> : <div className="site-admin__canvas-list">{form.blocks.map((block, index) => <article className={`site-admin__canvas-block${selectedBlock?.id === block.id ? " is-selected" : ""}${block.active ? "" : " is-hidden"}`} key={block.id}><div className="site-admin__canvas-blockbar"><button type="button" className="site-admin__canvas-select" onClick={() => setSelectedBlockId(block.id)} aria-pressed={selectedBlock?.id === block.id}><span>{index + 1}. {blockNames[block.type]}</span><small>{block.title}</small></button><div className="site-admin__canvas-controls"><button type="button" disabled={index === 0} onClick={() => moveBlock(index, -1)} aria-label={`Đưa khối ${index + 1} lên`}>↑</button><button type="button" disabled={index === form.blocks.length - 1} onClick={() => moveBlock(index, 1)} aria-label={`Đưa khối ${index + 1} xuống`}>↓</button><button type="button" onClick={() => updateBlock(block.id, { active: !block.active })}>{block.active ? "Ẩn" : "Hiện"}</button></div></div><div className="site-admin__canvas-render" onClick={() => setSelectedBlockId(block.id)}><SiteBlockView blocks={[{ ...block, active: true }]} /></div>{!block.active && <span className="site-admin__hidden-label">Đang ẩn khỏi bản công khai</span>}</article>)}</div>}</div>
            <aside className="site-admin__panel site-admin__inspector" aria-label="Bảng chỉnh sửa phần"><div className="site-admin__subhead"><div><p className="site-admin__eyebrow">BẢNG CHỈNH SỬA</p><h3>{selectedBlock ? blockNames[selectedBlock.type] : "Chọn một phần"}</h3></div></div>{selectedBlock ? <BlockEditor block={selectedBlock} index={selectedIndex} total={form.blocks.length} onChange={(patch) => updateBlock(selectedBlock.id, patch)} onMove={(delta) => moveBlock(selectedIndex, delta)} onRemove={() => removeBlock(selectedBlock.id)} /> : <p className="site-admin__muted">Chọn một phần trong bản xem bố cục để chỉnh nội dung.</p>}</aside></div>
        </>}
        {libraryOpen && <div className="site-admin__sheet-backdrop" role="presentation" onClick={() => setLibraryOpen(false)}><section className="site-admin__sheet" role="dialog" aria-modal="true" aria-labelledby="site-block-library-title" onClick={(event) => event.stopPropagation()}><div className="site-admin__subhead"><div><p className="site-admin__eyebrow">THƯ VIỆN KHỐI</p><h2 id="site-block-library-title">Thêm phần vào trang</h2><p>Chọn theo mục đích sử dụng. Phần mới sẽ xuất hiện ngay trong bản xem bố cục.</p></div><button type="button" className="site-admin__sheet-close" onClick={() => setLibraryOpen(false)} aria-label="Đóng thư viện khối">×</button></div><label>Tìm loại phần<input ref={librarySearchRef} value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Tiêu đề, ảnh, câu hỏi..." /></label><div className="site-admin__library-list">{libraryEntries.map(([type, name]) => <button type="button" key={type} onClick={() => addBlock(type)}><strong>{name}</strong><span>{blockDescriptions[type]}</span></button>)}{libraryEntries.length === 0 && <p>Không có loại phần phù hợp.</p>}</div></section></div>}
        {detail.revisions.length > 0 && <div className="site-admin__panel"><h3>Lịch sử phiên bản</h3><ul className="site-admin__history">{detail.revisions.map((revision) => <li key={revision.id}>Bản {revision.versionNumber} · {revision.status === "draft" ? "Nháp" : "Đã xuất bản"}{revision.status === "published" && revision.id !== detail.published?.id && <Button disabled={working} onClick={() => restore(revision.id)} size="sm" variant="outline">Chọn lại bản này</Button>}</li>)}</ul></div>}
      </>}</div></div>}
  </section>;
}
