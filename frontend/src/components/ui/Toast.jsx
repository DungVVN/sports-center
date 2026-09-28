import { X, Bell, AlertCircle, CheckCircle, Info } from "lucide-react";
import "./Toast.css";

const icons = {
  success: <CheckCircle size={20} />,
  error: <AlertCircle size={20} />,
  warning: <Bell size={20} />,
  info: <Info size={20} />
};

export function Toast({ message, type, onClose }) {
  return (
    <div className={`toast toast--${type}`} role={type === "error" || type === "warning" ? "alert" : "status"}>
      <div className="toast__icon">{icons[type] || icons.info}</div>
      <p className="toast__message">{message}</p>
      <button className="toast__close" onClick={onClose} aria-label="Đóng">
        <X size={16} />
      </button>
    </div>
  );
}
