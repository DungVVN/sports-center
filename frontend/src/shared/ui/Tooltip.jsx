import { useId, useState } from "react";
import "./Tooltip.css";

export function Tooltip({ children, label }) {
  const [visible, setVisible] = useState(false);
  const descriptionId = useId();
  return <span className="tooltip" onBlur={() => setVisible(false)} onFocus={() => setVisible(true)} onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
    {typeof children === "function" ? children({ "aria-describedby": visible ? descriptionId : undefined }) : children}
    {visible && <span className="tooltip__content" id={descriptionId} role="tooltip">{label}</span>}
  </span>;
}
