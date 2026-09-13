import { useEffect, useId } from "react";
import { X } from "lucide-react";
import { Button } from "./Button.jsx";
import "./Dialog.css";

export function Dialog({ children, isOpen, onClose, title }) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return <div className="dialog-backdrop" onMouseDown={onClose} role="presentation">
    <section aria-labelledby={titleId} aria-modal="true" className="dialog" onMouseDown={(event) => event.stopPropagation()} role="dialog">
      <header className="dialog__header"><h2 id={titleId}>{title}</h2><Button aria-label="Đóng hộp thoại" className="dialog__close" onClick={onClose} size="sm" variant="ghost"><X aria-hidden="true" size={18} /></Button></header>
      {children}
    </section>
  </div>;
}
