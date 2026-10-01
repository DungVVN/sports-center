import { useState } from "react";
export function ProfileAvatar({ src, alt, fallback }) {
  const [failed, setFailed] = useState(false);
  return !src || failed ? (
    fallback
  ) : (
    <img alt={alt} onError={() => setFailed(true)} src={src} />
  );
}
