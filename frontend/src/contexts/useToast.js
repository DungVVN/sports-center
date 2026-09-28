import { useContext } from "react";
import { ToastContext } from "./toast-context.js";

export function useToast() {
  return useContext(ToastContext);
}
