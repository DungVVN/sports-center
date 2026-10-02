import { Dialog } from "./Dialog.jsx";
import "./RecordDetails.css";

export function RecordDetails({ title, isOpen, onClose, fields, children }) {
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={title}>
      <div className="record-details">
        <dl className="record-details__fields">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value === null || value === undefined || value === "" ? "—" : value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </div>
    </Dialog>
  );
}
