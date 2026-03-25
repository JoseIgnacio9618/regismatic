import type { NextFunction, Request, Response } from "express";

const BLOCKED_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_SANITIZE_DEPTH = 12;

const sanitizeValue = (value: unknown, path: string, depth = 0): unknown => {
  if (depth > MAX_SANITIZE_DEPTH) {
    throw new Error(`Request payload is too deeply nested at ${path || "root"}.`);
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    if (value.includes("\0")) {
      throw new Error(`Null bytes are not allowed in ${path || "request"}.`);
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`, depth + 1));
  }

  if (Buffer.isBuffer(value) || value instanceof Date) {
    return value;
  }

  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(input)) {
      if (BLOCKED_OBJECT_KEYS.has(key)) {
        throw new Error(`Blocked object key received at ${path ? `${path}.` : ""}${key}.`);
      }

      sanitized[key] = sanitizeValue(nestedValue, path ? `${path}.${key}` : key, depth + 1);
    }

    return sanitized;
  }

  return value;
};

export const requestSanitizationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.params = sanitizeValue(req.params, "params") as Request["params"];
    req.query = sanitizeValue(req.query, "query") as Request["query"];

    if (!Buffer.isBuffer(req.body)) {
      req.body = sanitizeValue(req.body, "body") as Request["body"];
    }

    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request payload.";
    return res.status(400).json({ message });
  }
};
