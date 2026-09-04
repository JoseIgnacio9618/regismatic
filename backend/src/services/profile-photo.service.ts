import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { AppError } from "../middlewares/error.middleware";

const allowedMimeTypes = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"]
]);

export const MAX_PROFILE_PHOTO_BYTES = 512 * 1024;

export const isSupportedProfilePhotoMimeType = (mimeType: string): boolean => allowedMimeTypes.has(mimeType);

export const buildProfilePhotoApiPath = (userId: string, storedPath: string | null | undefined): string | null =>
  storedPath ? `/api/users/${userId}/photo` : null;

const getStorage = () => {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new AppError("Profile photo storage is not configured.", 503);
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  }).storage.from(env.SUPABASE_PROFILE_PHOTOS_BUCKET);
};

export const saveProfilePhotoFile = async (file: Express.Multer.File): Promise<string> => {
  const extension = allowedMimeTypes.get(file.mimetype);

  if (!extension) {
    throw new AppError("Invalid profile photo format.", 400);
  }

  const filePath = `${randomUUID()}${extension}`;
  const { error } = await getStorage().upload(filePath, file.buffer, {
    contentType: file.mimetype,
    upsert: false
  });

  if (error) {
    throw new AppError("Could not store profile photo.", 502);
  }

  return filePath;
};

export const deleteStoredProfilePhoto = async (publicPath: string | null | undefined): Promise<void> => {
  if (!publicPath?.trim()) {
    return;
  }

  const { error } = await getStorage().remove([publicPath]);
  if (error) {
    throw new AppError("Could not delete profile photo.", 502);
  }
};

export const downloadStoredProfilePhoto = async (storedPath: string): Promise<Blob> => {
  const { data, error } = await getStorage().download(storedPath);
  if (error || !data) {
    throw new AppError("User not found.", 404);
  }

  return data;
};
