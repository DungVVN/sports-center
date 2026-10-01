import { useState } from "react";
import { Eye, FilePenLine, FileText, LayoutTemplate, Search } from "lucide-react";
import { Button } from "../../../shared/ui/Button.jsx";

const pageName = (page) => page.title || (page.route_key === "home" ? "Trang chủ" : page.route_key);

function PageCatalogToolbar({ search, setSearch, status, setStatus }) {
  return (
    <div className="site-admin__catalog-filters">
      <label className="site-admin__search">
        <Search size={18} aria-hidden="true" />
        <input
          aria-label="Tìm trang website"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo tên hoặc đường dẫn"
        />
      </label>
      <select aria-label="Lọc trạng thái website" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="all">Tất cả trạng thái website</option>
        <option value="published">Đã xuất bản</option>
        <option value="draft">Chưa xuất bản</option>
      </select>
    </div>
  );
}

function PageCatalogTable({ pages, onOpen }) {
  if (pages.length === 0) {
    return <div className="site-admin__catalog-empty">Không có trang phù hợp với bộ lọc.</div>;
  }

  return (
    <div className="site-admin__catalog-scroll">
      <table>
        <thead>
          <tr>
            <th>TRANG WEBSITE</th>
            <th>BỐ CỤC & DỮ LIỆU</th>
            <th>TRẠNG THÁI</th>
            <th>HÀNH ĐỘNG</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id}>
              <td>
                <div className="site-admin__page-identity">
                  <span className="site-admin__page-icon">
                    <FileText size={20} aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{pageName(page)}</strong>
                    <small>{page.path}</small>
                  </span>
                </div>
              </td>
              <td>
                <span className="site-admin__tag site-admin__tag--builder">Page Builder</span>
                <small className="site-admin__table-caption">
                  <LayoutTemplate size={14} aria-hidden="true" />
                  {page.block_count ?? 0} phần nội dung có thể chỉnh sửa
                </small>
                {page.path === "/calendar" && <small className="site-admin__table-caption">Lịch sân & đặt chỗ lấy từ dữ liệu nghiệp vụ</small>}
              </td>
              <td>
                <span className={`site-admin__tag ${page.is_active === false ? "site-admin__tag--inactive" : "site-admin__tag--active"}`}>
                  {page.is_active === false ? "Route tạm ẩn" : "Route đang hoạt động"}
                </span>
                <small className="site-admin__table-caption">
                  {page.published_version ? `Website ở bản v${page.published_version}` : "Website chưa xuất bản"}
                  {page.draft_version ? ` · Bản nháp v${page.draft_version}` : ""}
                </small>
                {page.updated_at && (
                  <small className="site-admin__table-caption">
                    {new Date(page.updated_at).toLocaleString("vi-VN")}
                  </small>
                )}
              </td>
              <td>
                <div className="site-admin__row-actions">
                  <button type="button" className="site-admin__edit-action" aria-label={`Sửa trang ${pageName(page)}`} onClick={() => onOpen(page.route_key)}>
                    <FilePenLine size={18} />
                  </button>
                  <button type="button" aria-label={`Xem trước trang ${pageName(page)}`} onClick={() => onOpen(page.route_key, true)}>
                    <Eye size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SitePageCatalog({ pages, onOpen, onCreate, showCreate, setShowCreate, createForm, setCreateForm, working, notice, error }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = pages.filter((page) => {
    const matchesText = `${pageName(page)} ${page.route_key} ${page.path}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"));
    return matchesText && (status === "all" || (status === "published" ? Boolean(page.published_version) : !page.published_version));
  });

  return (
    <section className="site-admin site-admin--catalog">
      <header className="site-admin__header site-admin__catalog-header">
        <div>
          <p className="site-admin__eyebrow">CMS · TRANG</p>
          <h1>Danh mục trang toàn website</h1>
          <p>Mỗi trang có bố cục riêng; dữ liệu gói tập, lịch và đặt chỗ được quản lý ở các mục nghiệp vụ.</p>
        </div>
        <div className="site-admin__actions">
          <a className="site-admin__action-link" href="/admin/site/menu">Menu website</a>
          <Button onClick={() => setShowCreate((value) => !value)}>+ Tạo trang</Button>
        </div>
      </header>

      {notice && <p className="site-admin__notice" role="status">{notice}</p>}
      {error && <p className="site-admin__error" role="alert">{error}</p>}

      {showCreate && (
        <form className="site-admin__panel site-admin__create" onSubmit={(event) => { event.preventDefault(); void onCreate({ ...createForm, kind: "static" }); }}>
          <label>Khóa route<input required maxLength={80} pattern="[a-z][a-z0-9_-]*" value={createForm.routeKey} onChange={(event) => setCreateForm({ ...createForm, routeKey: event.target.value })} placeholder="gioi-thieu" /></label>
          <label>Đường dẫn<input required value={createForm.path} onChange={(event) => setCreateForm({ ...createForm, path: event.target.value })} placeholder="/gioi-thieu" /></label>
          <label>Tiêu đề<input required value={createForm.title} onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })} /></label>
          <Button disabled={working} type="submit">Tạo bản nháp</Button>
        </form>
      )}

      {!pages.some((page) => page.route_key === "home") && (
        <div className="site-admin__panel site-admin__empty">
          <p>Trang chủ chưa có bản quản trị. Website vẫn hiển thị nội dung hiện tại.</p>
          <Button disabled={working} onClick={() => onCreate({ routeKey: "home", path: "/", kind: "home", title: "Trang chủ" })}>Khởi tạo bản nháp trang chủ</Button>
        </div>
      )}

      <div className="site-admin__catalog site-admin__panel">
        <PageCatalogToolbar search={search} setSearch={setSearch} status={status} setStatus={setStatus} />
        <PageCatalogTable pages={filtered} onOpen={onOpen} />
        <footer className="site-admin__catalog-footer">
          Đang hiển thị <strong>{filtered.length}</strong> trên tổng số <strong>{pages.length}</strong> trang
        </footer>
      </div>
    </section>
  );
}
