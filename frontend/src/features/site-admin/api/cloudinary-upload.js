import { siteAdminApi } from "./site-admin-api.js";
import { uploadCloudinaryImage } from "../../../shared/api/cloudinary-upload.js";

export async function uploadSiteImage(file) {
  return uploadCloudinaryImage(file, siteAdminApi.cloudinarySignature, async (result) => {
    await siteAdminApi.recordCloudinaryUpload({
    secureUrl: result.secure_url, publicId: result.public_id, originalName: file.name, mimeType: result.format ? `image/${result.format === "jpg" ? "jpeg" : result.format}` : file.type,
    bytes: result.bytes, width: result.width ?? null, height: result.height ?? null,
    });
  });
}
