import bcrypt from "bcryptjs";
import { type Role } from "@prisma/client";
import { AppError } from "../middlewares/error.middleware";
import { prisma } from "../config/prisma";
import { signToken } from "../utils/jwt";
import { ensureAdminInviteCode, generateUniqueAdminInviteCode } from "./admin-invite.service";
import { buildProfilePhotoApiPath } from "./profile-photo.service";
import { createTeamJoinRequestForEmployee } from "./team-join-request.service";

const buildAuthResponse = (user: {
  id: string;
  email: string;
  fullName: string;
  profilePhotoPath?: string | null;
  role: Role;
  adminInviteCode?: string | null;
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
      profilePhotoUrl: buildProfilePhotoApiPath(user.id, user.profilePhotoPath),
      role: user.role,
      adminInviteCode: user.adminInviteCode ?? null
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

  const adminInviteCode = await ensureAdminInviteCode(user);
  return buildAuthResponse({ ...user, adminInviteCode });
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
  const adminInviteCode = role === "ADMIN" ? await generateUniqueAdminInviteCode() : null;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: params.fullName,
      role,
      adminInviteCode
    }
  });

  return buildAuthResponse(user);
};

export const registerEmployee = async (params: {
  email: string;
  password: string;
  fullName: string;
  inviteCode?: string;
  requestMessage?: string;
}) => {
  const email = params.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    throw new AppError("A user with this email already exists.", 409);
  }

  const passwordHash = await bcrypt.hash(params.password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: params.fullName,
      role: "EMPLOYEE"
    }
  });

  const inviteCode = params.inviteCode?.trim();
  if (inviteCode) {
    await createTeamJoinRequestForEmployee({
      employeeId: user.id,
      inviteCode,
      message: params.requestMessage
    });
  }

  return buildAuthResponse(user);
};
