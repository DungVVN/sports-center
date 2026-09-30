import { Button } from "../../../shared/ui/Button.jsx";
import { newMenuItem } from "./editor-model.js";

export function MenuItemEditor({ item, index, onChange, onMove, onRemove }) {
  const updateChild = (childIndex, patch) => onChange({ children: item.children.map((child, position) => position === childIndex ? { ...child, ...patch } : child) });
  const removeChild = (childIndex) => onChange({ children: item.children.filter((_, position) => position !== childIndex) });

  return <article className="site-admin__block">
    <header>
      <strong>{index + 1}. {item.kind === "group" ? "Nhóm" : "Liên kết"}</strong>
      <div>
        <button onClick={() => onMove(-1)} type="button" aria-label={`Đưa mục ${index + 1} lên`}>↑</button>
        <button onClick={() => onMove(1)} type="button" aria-label={`Đưa mục ${index + 1} xuống`}>↓</button>
        <button onClick={onRemove} type="button">Xóa</button>
      </div>
    </header>
    <div className="site-admin__fields">
      <label>Nhãn<input maxLength={80} value={item.label} onChange={(event) => onChange({ label: event.target.value })} /></label>
      <label className="site-admin__check"><input checked={item.active} onChange={(event) => onChange({ active: event.target.checked })} type="checkbox" />Hiển thị</label>
      {item.kind === "link" && <label>Đường dẫn<input value={item.href} onChange={(event) => onChange({ href: event.target.value })} placeholder="/gioi-thieu hoặc https://..." /></label>}
    </div>
    {item.kind === "group" && <div className="site-admin__children">
      {item.children.map((child, childIndex) => <div className="site-admin__child" key={child.id}>
        <input aria-label={`Nhãn mục con ${childIndex + 1}`} value={child.label} onChange={(event) => updateChild(childIndex, { label: event.target.value })} />
        <input aria-label={`Đường dẫn mục con ${childIndex + 1}`} value={child.href} onChange={(event) => updateChild(childIndex, { href: event.target.value })} />
        <label className="site-admin__check"><input checked={child.active} onChange={(event) => updateChild(childIndex, { active: event.target.checked })} type="checkbox" />Hiện</label>
        <button onClick={() => removeChild(childIndex)} type="button">Bỏ</button>
      </div>)}
      <Button disabled={item.children.length >= 12} onClick={() => onChange({ children: [...item.children, newMenuItem()] })} size="sm" variant="outline">Thêm mục con</Button>
    </div>}
  </article>;
}
