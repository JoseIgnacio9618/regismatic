import bcrypt from "bcryptjs";
import { AppError } from "../middlewares/error.middleware";
import { prisma } from "../config/prisma";
import { signToken } from "../utils/jwt";

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  if (!user || !user.isActive) {
    throw new AppError("Invalid credentials.", 401);
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);
  if (!validPassword) {
    throw new AppError("Invalid credentials.", 401);
  }

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
