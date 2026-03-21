import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";
import { ensureAdminInviteCode } from "../services/admin-invite.service";
import { login, registerAdmin, registerEmployee } from "../services/auth.service";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerAdminSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10)
    .regex(/[a-z]/, "Password must include lowercase letters.")
    .regex(/[A-Z]/, "Password must include uppercase letters.")
    .regex(/[0-9]/, "Password must include at least one number.")
    .regex(/[^a-zA-Z0-9]/, "Password must include at least one special character."),
  fullName: z.string().min(3)
});

const registerEmployeeSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10)
    .regex(/[a-z]/, "Password must include lowercase letters.")
    .regex(/[A-Z]/, "Password must include uppercase letters.")
    .regex(/[0-9]/, "Password must include at least one number.")
    .regex(/[^a-zA-Z0-9]/, "Password must include at least one special character."),
  fullName: z.string().min(3),
  inviteCode: z.string().trim().min(3).optional(),
  requestMessage: z.string().trim().max(300).optional()
});

export const loginController = async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);
  const result = await login(payload.email, payload.password);
  return res.json(result);
};

export const registerAdminController = async (req: Request, res: Response) => {
  const payload = registerAdminSchema.parse(req.body);
  const result = await registerAdmin(payload);
  return res.status(201).json(result);
};

export const registerEmployeeController = async (req: Request, res: Response) => {
  const payload = registerEmployeeSchema.parse(req.body);
  const result = await registerEmployee(payload);
  return res.status(201).json(result);
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
      profilePhotoPath: true,
      role: true,
      adminInviteCode: true,
      managerId: true,
      isActive: true,
      createdAt: true
    }
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const adminInviteCode = await ensureAdminInviteCode(user);
  const { profilePhotoPath, ...rest } = user;
  return res.json({
    ...rest,
    adminInviteCode,
    profilePhotoUrl: profilePhotoPath ?? null
  });
};
