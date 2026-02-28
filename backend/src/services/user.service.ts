import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";

export const createUser = async (params: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
}) => {
  const existing = await prisma.user.findUnique({ where: { email: params.email.toLowerCase() } });
  if (existing) {
    throw new AppError("A user with this email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(params.password, 12);

  const user = await prisma.user.create({
    data: {
      email: params.email.toLowerCase(),
      passwordHash,
      fullName: params.fullName,
      role: params.role
    }
  });

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
};

export const listUsers = async () => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
      createdAt: true
    }
  });

  return users;
};
