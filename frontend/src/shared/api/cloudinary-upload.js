import { ApiError } from "./api-error.js";

const imageType = /^image\/[a-z0-9][a-z0-9.+-]*$/i;
const imageExtension = /\.(avif|bmp|dib|gif|heic|heif|ico|jfif|jpe|jpeg|jpg|jxl|pjp|pjpeg|png|psd|svg|svgz|tif|tiff|webp)$/i;
const maxBytes = 20 * 1024 * 1024;

export async function uploadCloudinaryImage(file, getSignature, afterUpload = async () => {}) {
  if (!file) throw new ApiError({ code: "IMAGE_REQUIRED", message: "Hãy chọn một ảnh để tải lên." });
  const isImage = imageType.test(file.type) || ((!file.type || file.type === "application/octet-stream") && imageExtension.test(file.name));
  if (!isImage) throw new ApiError({ code: "IMAGE_TYPE_INVALID", message: "Vui lòng chọn một tệp ảnh." });
  if (file.size > maxBytes) throw new ApiError({ code: "IMAGE_TOO_LARGE", message: "Ảnh tối đa 20 MB." });
  const signature = await getSignature();
  if (file.size > signature.maxBytes) throw new ApiError({ code: "IMAGE_TOO_LARGE", message: "Ảnh vượt quá dung lượng được máy chủ cho phép." });
  const body = new FormData();
  body.set("file", file);
  body.set("api_key", signature.apiKey);
  body.set("timestamp", String(signature.timestamp));
  body.set("signature", signature.signature);
  body.set("folder", signature.folder);
  let response;
  try { response = await fetch(signature.uploadUrl, { method: "POST", body }); }
  catch { throw new ApiError({ code: "CLOUDINARY_NETWORK_ERROR", message: "Không thể kết nối Cloudinary. Hãy thử lại." }); }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.secure_url || !result?.public_id) throw new ApiError({ code: "CLOUDINARY_UPLOAD_FAILED", message: result?.error?.message || "Cloudinary không thể tải ảnh lên." });
  await afterUpload(result);
  return result.secure_url;
}
