import { useId, useRef, useState } from "react";
import { Button } from "../../../shared/ui/Button.jsx";

function imageName(value) {
  if (!value) return "Chưa chọn ảnh";
  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || url.hostname);
  } catch {
    return value;
  }
}

export function ProfileAvatarField({ value, uploading, onChange, onUpload }) {
  const id = useId();
  const input = useRef(null);
  const [uploaded, setUploaded] = useState(null);
  const name = uploaded?.url === value ? uploaded.name : imageName(value);

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = await onUpload(event);
    if (url) setUploaded({ url, name: file.name });
  }

  return (
    <div className="profile-page__avatar-field">
      <label htmlFor={id}>Ảnh đại diện</label>
      <div className="profile-page__avatar-controls">
        <input
          id={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://example.com/avatar.jpg"
          type="url"
          value={value}
        />
        <div className="profile-page__avatar-picker">
          <Button variant="outline" loading={uploading} onClick={() => input.current?.click()}>
            {uploading ? "Đang tải ảnh" : "Chọn ảnh"}
          </Button>
          <span className="profile-page__avatar-filename" title={name} aria-live="polite">{name}</span>
          <input
            ref={input}
            accept="image/*"
            aria-label="Chọn file ảnh đại diện"
            disabled={uploading}
            hidden
            onChange={chooseFile}
            type="file"
          />
        </div>
      </div>
    </div>
  );
}
