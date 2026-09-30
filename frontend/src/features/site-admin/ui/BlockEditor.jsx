import { Button } from "../../../shared/ui/Button.jsx";
import { blockNames } from "./editor-model.js";
import { uploadSiteImage } from "../api/cloudinary-upload.js";
import { useState } from "react";

function BlockField({ block, field, label, multiline = false, onChange }) {
  const value = block[field] ?? "";
  return <label>{label}{multiline
    ? <textarea value={value} onChange={(event) => onChange({ [field]: event.target.value })} rows={3} />
    : <input value={value} onChange={(event) => onChange({ [field]: event.target.value })} />}</label>;
}

function FaqFields({ block, onChange }) {
  return <div className="site-admin__faq">
    {block.items.map((item, itemIndex) => <div key={itemIndex}>
      <input aria-label={`Câu hỏi ${itemIndex + 1}`} value={item.question} onChange={(event) => onChange({ items: block.items.map((current, index) => index === itemIndex ? { ...current, question: event.target.value } : current) })} />
      <textarea aria-label={`Câu trả lời ${itemIndex + 1}`} value={item.answer} onChange={(event) => onChange({ items: block.items.map((current, index) => index === itemIndex ? { ...current, answer: event.target.value } : current) })} />
      <button onClick={() => onChange({ items: block.items.filter((_, index) => index !== itemIndex) })} type="button">Bỏ câu hỏi</button>
    </div>)}
    <Button disabled={block.items.length >= 20} onClick={() => onChange({ items: [...block.items, { question: "Câu hỏi", answer: "Câu trả lời" }] })} size="sm" variant="outline">Thêm câu hỏi</Button>
  </div>;
}

function ImageField({ block, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function selectImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true); setError("");
    try { onChange({ imageUrl: await uploadSiteImage(file) }); }
    catch (cause) { setError(cause?.message || "Không thể tải ảnh lên."); }
    finally { setUploading(false); }
  }
  return <div className="site-admin__image-field">
    <BlockField block={block} field="imageUrl" label="URL ảnh" onChange={onChange} />
    <label>Hoặc tải ảnh từ máy<input accept="image/jpeg,image/png,image/webp,image/gif,image/avif" disabled={uploading} onChange={selectImage} type="file" /></label>
    <small>JPG, PNG, WebP, GIF hoặc AVIF · tối đa 10 MB{uploading ? " · Đang tải..." : ""}</small>
    {error && <p role="alert" className="site-admin__error">{error}</p>}
  </div>;
}

export function BlockEditor({ block, index, total, onChange, onMove, onRemove }) {
  const field = (name, label, multiline = false) => <BlockField block={block} field={name} label={label} multiline={multiline} onChange={onChange} />;

  return <article className="site-admin__block site-admin__block--inspector">
    <header>
      <strong>{index + 1}. {blockNames[block.type]}</strong>
      <div>
        <label className="site-admin__check"><input checked={block.active} onChange={(event) => onChange({ active: event.target.checked })} type="checkbox" />Hiển thị</label>
        <button disabled={index === 0} onClick={() => onMove(-1)} type="button" aria-label={`Đưa khối ${index + 1} lên`}>↑</button>
        <button disabled={index === total - 1} onClick={() => onMove(1)} type="button" aria-label={`Đưa khối ${index + 1} xuống`}>↓</button>
        <button onClick={onRemove} type="button">Xóa</button>
      </div>
    </header>
    <div className="site-admin__fields">
      {block.type === "hero" && field("eyebrow", "Dòng dẫn")}
      {field("title", "Tiêu đề")}
      {block.type !== "faq" && block.type !== "hero" && field("body", "Nội dung", true)}
      {block.type === "hero" && field("description", "Mô tả", true)}
      {["hero", "imageText"].includes(block.type) && <ImageField block={block} onChange={onChange} />}
      {block.type === "imageText" && field("imageAlt", "Mô tả ảnh")}
      {["hero", "cta"].includes(block.type) && <>{field("buttonLabel", "Nhãn nút")}{field("buttonHref", "Đường dẫn nút")}</>}
      {block.type === "faq" && <FaqFields block={block} onChange={onChange} />}
    </div>
  </article>;
}
