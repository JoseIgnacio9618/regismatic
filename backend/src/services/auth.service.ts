import bcrypt from "bcryptjs";
import { type Role } from "@prisma/client";
import { AppError } from "../middlewares/error.middleware";
import { prisma } from "../config/prisma";
import { signToken } from "../utils/jwt";

const buildAuthResponse = (user: {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}) => {
  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    }
  };
};

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials.", 401);
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new AppError("Invalid credentials.", 401);
  }

  return buildAuthResponse(user);
};

export const registerAdmin = async (params: {
  email: string;
  password: string;
  fullName: string;
}) => {
  const email = params.email.toLowerCase();
  const [existing, superadminCount] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.user.count({
      where: {
        role: "SUPERADMIN"
      }
    })
  ]);

  if (existing) {
    throw new AppError("A user with this email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(params.password, 12);
  const role = superadminCount === 0 ? "SUPERADMIN" : "ADMIN";

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: params.fullName,
      role
    }
  });

  return buildAuthResponse(user);
};
