import { useEffect, useId, useRef, useState } from "react";

const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
let scriptPromise;

function loadRecaptcha() {
  if (window.grecaptcha) return Promise.resolve(window.grecaptcha);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.grecaptcha);
      script.onerror = () => reject(new Error("Không tải được reCAPTCHA."));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function CaptchaField({ onTokenChange }) {
  const host = useRef(null);
  const widgetId = useRef(null);
  const [error, setError] = useState("");
  const id = useId();

  useEffect(() => {
    if (!siteKey) {
      onTokenChange?.(undefined);
      return undefined;
    }
    let live = true;
    loadRecaptcha().then((grecaptcha) => {
      if (!live || !host.current) return;
      widgetId.current = grecaptcha.render(host.current, {
        sitekey: siteKey,
        callback: (token) => onTokenChange?.(token),
        "expired-callback": () => onTokenChange?.(undefined),
        "error-callback": () => { onTokenChange?.(undefined); setError("Không thể xác minh CAPTCHA. Vui lòng thử lại."); },
      });
    }).catch(() => { if (live) setError("Không tải được CAPTCHA. Vui lòng kiểm tra kết nối và thử lại."); });
    return () => {
      live = false;
      if (widgetId.current !== null && window.grecaptcha?.reset) window.grecaptcha.reset(widgetId.current);
    };
  }, [onTokenChange]);

  if (!siteKey) return null;
  return <div className="field captcha-field" aria-labelledby={`${id}-label`}><span id={`${id}-label`}>Xác minh bảo mật</span><div ref={host} />{error && <small role="alert">{error}</small>}</div>;
}
