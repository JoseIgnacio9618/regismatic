import type { Request } from "express";

const normalizeIp = (value: string | undefined | null): string | null => {
  if (!value) {
    return null;
  }

  const candidate = value.split(",")[0]?.trim();
  if (!candidate) {
    return null;
  }

  return candidate.replace(/^::ffff:/i, "");
};

export const getRequestIp = (req: Request): string | null => {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string") {
    return normalizeIp(forwardedFor);
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return normalizeIp(forwardedFor[0]);
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") {
    return normalizeIp(realIp);
  }

  return normalizeIp(req.ip);
};
