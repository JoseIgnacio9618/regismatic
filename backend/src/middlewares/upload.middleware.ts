import multer from "multer";
import { AppError } from "./error.middleware";
import { isSupportedProfilePhotoMimeType, MAX_PROFILE_PHOTO_BYTES } from "../services/profile-photo.service";

export const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PROFILE_PHOTO_BYTES
  },
  fileFilter: (_req, file, callback) => {
    if (!isSupportedProfilePhotoMimeType(file.mimetype)) {
      callback(new AppError("Invalid profile photo format.", 400));
      return;
    }

    callback(null, true);
  }
});
