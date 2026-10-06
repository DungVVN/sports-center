import { Button } from "../../../shared/ui/Button.jsx";
import { newMenuItem } from "./editor-model.js";
import { GripVertical, Trash2, ArrowUp, ArrowDown } from "lucide-react";

export function MenuItemEditor({ item, index, onChange, onMove, onRemove }) {
  const updateChild = (childIndex, patch) => onChange({ children: item.children.map((child, position) => position === childIndex ? { ...child, ...patch } : child) });
  const removeChild = (childIndex) => onChange({ children: item.children.filter((_, position) => position !== childIndex) });

  return (
    <div className="site-admin__block site-admin__block--inspector">
      <header>
        <strong>Mục #{index + 1} ({item.kind === "group" ? "Nhóm" : "Liên kết"})</strong>
        <div className="site-admin__canvas-controls">
          <button onClick={() => onMove(-1)} type="button" aria-label={`Đưa mục ${index + 1} lên`} title="Đẩy lên"><ArrowUp size={16} /></button>
          <button onClick={() => onMove(1)} type="button" aria-label={`Đưa mục ${index + 1} xuống`} title="Đẩy xuống"><ArrowDown size={16} /></button>
          <button onClick={onRemove} type="button" title="Xoá mục này" style={{ color: "var(--color-danger)" }}><Trash2 size={16} /></button>
        </div>
      </header>

      <div className="site-admin__fields">
        <label>
          Tên hiển thị (Nhãn)
          <input maxLength={80} value={item.label} onChange={(event) => onChange({ label: event.target.value })} placeholder="VD: Giới thiệu" />
        </label>

        {item.kind === "link" && (
          <label>
            Đường dẫn (URL)
            <input value={item.href} onChange={(event) => onChange({ href: event.target.value })} placeholder="/gioi-thieu hoặc https://..." />
          </label>
        )}

        <label className="site-admin__check">
          <input checked={item.active} onChange={(event) => onChange({ active: event.target.checked })} type="checkbox" />
          Cho phép hiển thị ngoài Website
        </label>
      </div>

      {item.kind === "group" && (
        <div className="site-admin__children">
          <h4 style={{ margin: "10px 0 0", fontSize: 13, color: "var(--color-text-secondary)" }}>Các mục con ({item.children.length}/12)</h4>
          {item.children.map((child, childIndex) => (
            <div className="site-admin__panel" key={child.id} style={{ padding: 12, borderStyle: "dashed" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, display: "flex", gap: 6, alignItems: "center" }}><GripVertical size={14} style={{ opacity: 0.5 }}/> Mục con #{childIndex + 1}</span>
                <button onClick={() => removeChild(childIndex)} type="button" title="Xóa" style={{ color: "var(--color-danger)", border: 0, background: "transparent", cursor: "pointer" }}><Trash2 size={14} /></button>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <input aria-label={`Nhãn mục con ${childIndex + 1}`} value={child.label} onChange={(event) => updateChild(childIndex, { label: event.target.value })} placeholder="Tên hiển thị" />
                <input aria-label={`Đường dẫn mục con ${childIndex + 1}`} value={child.href} onChange={(event) => updateChild(childIndex, { href: event.target.value })} placeholder="Đường dẫn (URL)" />
                <label className="site-admin__check" style={{ fontSize: 12 }}>
                  <input checked={child.active} onChange={(event) => updateChild(childIndex, { active: event.target.checked })} type="checkbox" /> Hiển thị
                </label>
              </div>
            </div>
          ))}
          <Button disabled={item.children.length >= 12} onClick={() => onChange({ children: [...item.children, newMenuItem()] })} size="sm" variant="outline" style={{ marginTop: 8 }}>+ Thêm mục con</Button>
        </div>
      )}
    </div>
  );
}
