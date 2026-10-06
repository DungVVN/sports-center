import { ApiError } from "./api-error.js";

const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const maxBytes = 10 * 1024 * 1024;

export async function uploadCloudinaryImage(file, getSignature, afterUpload = async () => {}) {
  if (!file) throw new ApiError({ code: "IMAGE_REQUIRED", message: "Hãy chọn một ảnh để tải lên." });
  if (!acceptedTypes.includes(file.type)) throw new ApiError({ code: "IMAGE_TYPE_INVALID", message: "Chỉ nhận ảnh JPG, PNG, WebP, GIF hoặc AVIF." });
  if (file.size > maxBytes) throw new ApiError({ code: "IMAGE_TOO_LARGE", message: "Ảnh tối đa 10 MB." });
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
