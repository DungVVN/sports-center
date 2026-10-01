import { createHash } from "node:crypto";
import { AppError } from "../../../shared/errors/app-error.js";

const siteFolder = "kinetic-sports/site";
const profileFolder = "kinetic-sports/avatars";
const maxBytes = 10 * 1024 * 1024;

function configuration() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) {
    throw new AppError({ statusCode: 503, code: "CLOUDINARY_NOT_CONFIGURED", message: "Cloudinary chưa được cấu hình trên máy chủ." });
  }
  return { cloudName, apiKey, apiSecret };
}

export function createCloudinaryMediaService({ repository, now = () => Math.floor(Date.now() / 1000) }) {
  return {
    createUploadSignature(folder = siteFolder) {
      const { cloudName, apiKey, apiSecret } = configuration();
      const timestamp = now();
      // Cloudinary signs sorted upload parameters followed directly by the API secret.
      const signature = createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest("hex");
      return {
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        maxBytes,
      };
    },
    createSiteUploadSignature() { return this.createUploadSignature(siteFolder); },
    createProfileUploadSignature() { return this.createUploadSignature(profileFolder); },
    async recordUpload(input, actorUserId) {
      const { cloudName } = configuration();
      const urlPrefix = `https://res.cloudinary.com/${cloudName}/image/upload/`;
      if (!input.secureUrl.startsWith(urlPrefix) || !input.publicId.startsWith(`${siteFolder}/`)) {
        throw new AppError({ statusCode: 422, code: "CLOUDINARY_ASSET_INVALID", message: "Ảnh không thuộc thư mục Cloudinary của website." });
      }
      if (input.bytes > maxBytes) throw new AppError({ statusCode: 422, code: "CLOUDINARY_FILE_TOO_LARGE", message: "Ảnh vượt quá dung lượng 10 MB." });
      return repository.createMediaAsset({
        storage_key: input.publicId,
        original_name: input.originalName,
        mime_type: input.mimeType,
        byte_size: input.bytes,
        width: input.width,
        height: input.height,
        uploaded_by: actorUserId,
      });
    },
  };
}
