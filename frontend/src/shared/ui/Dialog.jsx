import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button.jsx";
import { Tooltip } from "./Tooltip.jsx";
import "./Dialog.css";

export function Dialog({ children, isOpen, onClose, title }) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousFocus = document.activeElement;
    dialogRef.current?.querySelector("button, input, select, textarea, a[href]")?.focus();
    return () => previousFocus?.focus?.();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      const focusable = dialog && [...dialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]")];
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return <div className="dialog-backdrop" onMouseDown={onClose} role="presentation">
    <section aria-labelledby={titleId} aria-modal="true" className="dialog" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog">
      <header className="dialog__header"><h2 id={titleId}>{title}</h2><Tooltip label="Đóng hộp thoại">{(triggerProps) => <Button {...triggerProps} aria-label="Đóng hộp thoại" className="dialog__close" onClick={onClose} size="sm" variant="ghost"><X aria-hidden="true" size={18} /></Button>}</Tooltip></header>
      {children}
    </section>
  </div>;
}
