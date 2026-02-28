import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";
import { login } from "../services/auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export const loginController = async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);
  const result = await login(payload.email, payload.password);
  return res.json(result);
};

export const meController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return res.json(user);
};
