import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.jsx";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/layout.css";
import "./components/layout/WorkspacePage.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
