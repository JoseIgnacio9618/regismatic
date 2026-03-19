import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AppError } from "../middlewares/error.middleware";

const uploadsRoot = path.resolve(process.cwd(), "uploads");
const profilePhotosDir = path.join(uploadsRoot, "profile-photos");
const allowedMimeTypes = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"]
]);

export const MAX_PROFILE_PHOTO_BYTES = 512 * 1024;

export const isSupportedProfilePhotoMimeType = (mimeType: string): boolean => allowedMimeTypes.has(mimeType);

export const saveProfilePhotoFile = async (file: Express.Multer.File): Promise<string> => {
  const extension = allowedMimeTypes.get(file.mimetype);

  if (!extension) {
    throw new AppError("Invalid profile photo format.", 400);
  }

  await mkdir(profilePhotosDir, { recursive: true });

  const fileName = `${randomUUID()}${extension}`;
  const absolutePath = path.join(profilePhotosDir, fileName);

  await writeFile(absolutePath, file.buffer);

  return `/uploads/profile-photos/${fileName}`;
};

export const deleteStoredProfilePhoto = async (publicPath: string | null | undefined): Promise<void> => {
  if (!publicPath || !publicPath.startsWith("/uploads/profile-photos/")) {
    return;
  }

  const relativePath = publicPath.replace(/^\/+/, "");
  const absolutePath = path.resolve(process.cwd(), relativePath);

  try {
    await unlink(absolutePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code !== "ENOENT") {
      throw error;
    }
  }
};
