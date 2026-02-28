import type { Request, Response } from "express";
import { z } from "zod";
import { createUser, listUsers } from "../services/user.service";

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
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE")
});

export const createUserController = async (req: Request, res: Response) => {
  const payload = createUserSchema.parse(req.body);
  const user = await createUser(payload);
  return res.status(201).json(user);
};

export const listUsersController = async (_req: Request, res: Response) => {
  const users = await listUsers();
  return res.json(users);
};
