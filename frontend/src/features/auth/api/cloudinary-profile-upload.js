import { uploadCloudinaryImage } from "../../../shared/api/cloudinary-upload.js";
import { authApi } from "./auth-api.js";

export const uploadProfileAvatar = (file) => uploadCloudinaryImage(file, authApi.cloudinaryProfileAvatarSignature);
