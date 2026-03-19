import type { Request, Response } from "express";
import { z } from "zod";
import { AppError } from "../middlewares/error.middleware";
import {
  assignEmployeeManager,
  createUser,
  deleteUser,
  listUsers,
  removeUserProfilePhoto,
  updateUserProfilePhoto
} from "../services/user.service";

const createUserSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10)
    .regex(/[a-z]/, "Password must include lowercase letters.")
    .regex(/[A-Z]/, "Password must include uppercase letters.")
    .regex(/[0-9]/, "Password must include at least one number.")
    .regex(/[^a-zA-Z0-9]/, "Password must include at least one special character."),
  fullName: z.string().min(3),
  role: z.enum(["SUPERADMIN", "ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
  managerId: z.string().min(1).optional()
});

const assignManagerSchema = z.object({
  managerId: z.string().min(1)
});

export const createUserController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const payload = createUserSchema.parse(req.body);
  const user = await createUser({
    ...payload,
    creatorId: req.user.id
  });
  return res.status(201).json(user);
};

export const listUsersController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const users = await listUsers(req.user.id);
  return res.json(users);
};

export const deleteUserController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const userId = z.string().min(1).parse(req.params.userId);
  const deletedUser = await deleteUser({
    userId,
    requesterId: req.user.id
  });

  return res.json(deletedUser);
};

export const assignEmployeeManagerController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const payload = assignManagerSchema.parse(req.body);
  const userId = z.string().min(1).parse(req.params.userId);
  const user = await assignEmployeeManager({
    userId,
    managerId: payload.managerId,
    requesterId: req.user.id
  });

  return res.json(user);
};

export const updateOwnProfilePhotoController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  if (!req.file) {
    throw new AppError("Missing profile photo file.", 400);
  }

  const user = await updateUserProfilePhoto({
    requesterId: req.user.id,
    targetUserId: req.user.id,
    file: req.file
  });

  return res.json(user);
};

export const removeOwnProfilePhotoController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const user = await removeUserProfilePhoto({
    requesterId: req.user.id,
    targetUserId: req.user.id
  });

  return res.json(user);
};

export const updateUserProfilePhotoController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  if (!req.file) {
    throw new AppError("Missing profile photo file.", 400);
  }

  const userId = z.string().min(1).parse(req.params.userId);
  const user = await updateUserProfilePhoto({
    requesterId: req.user.id,
    targetUserId: userId,
    file: req.file
  });

  return res.json(user);
};

export const removeUserProfilePhotoController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const userId = z.string().min(1).parse(req.params.userId);
  const user = await removeUserProfilePhoto({
    requesterId: req.user.id,
    targetUserId: userId
  });

  return res.json(user);
};
