import bcrypt from "bcryptjs";
import { Prisma, type Role } from "@prisma/client";
import { access } from "node:fs/promises";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";
import { assertCanManageUser, assertCanViewUser, getScopedUserById, isElevatedRole } from "./access.service";
import { generateUniqueAdminInviteCode } from "./admin-invite.service";
import {
  buildProfilePhotoApiPath,
  deleteStoredProfilePhoto,
  resolveStoredProfilePhotoAbsolutePath,
  saveProfilePhotoFile
} from "./profile-photo.service";

const teamUserSelect = {
  id: true,
  email: true,
  fullName: true,
  profilePhotoPath: true,
  adminInviteCode: true,
  role: true,
  isActive: true,
  createdAt: true,
  manager: {
    select: {
      id: true,
      fullName: true,
      email: true
    }
  },
  _count: {
    select: {
      managedUsers: true
    }
  }
} satisfies Prisma.UserSelect;

type TeamUserRecord = Prisma.UserGetPayload<{ select: typeof teamUserSelect }>;

const roleSortOrder: Record<Role, number> = {
  SUPERADMIN: 0,
  ADMIN: 1,
  EMPLOYEE: 2
};

const mapTeamUser = (user: TeamUserRecord) => ({
  id: user.id,
  email: user.email,
  fullName: user.fullName,
  profilePhotoUrl: buildProfilePhotoApiPath(user.id, user.profilePhotoPath),
  adminInviteCode: user.role === "ADMIN" ? user.adminInviteCode ?? null : null,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  manager: user.manager ?? null,
  managedEmployeesCount: user._count.managedUsers
});

const validateEmployeeManager = async (managerId: string | undefined): Promise<string> => {
  if (!managerId) {
    throw new AppError("An employee must be assigned to an administrator.", 400);
  }

  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: {
      id: true,
      role: true,
      isActive: true
    }
  });

  if (!manager || manager.role !== "ADMIN" || !manager.isActive) {
    throw new AppError("Selected manager is not a valid administrator.", 400);
  }

  return manager.id;
};

export const createUser = async (params: {
  email: string;
  password: string;
  fullName: string;
  role: Role;
  managerId?: string;
  creatorId: string;
}) => {
  const creator = await getScopedUserById(params.creatorId);
  if (!isElevatedRole(creator.role)) {
    throw new AppError("Insufficient permissions.", 403);
  }

  const existing = await prisma.user.findUnique({ where: { email: params.email.toLowerCase() } });
  if (existing) {
    throw new AppError("A user with this email already exists.", 409);
  }

  if (creator.role === "ADMIN" && params.role !== "EMPLOYEE") {
    throw new AppError("Administrators can only create employees.", 403);
  }

  const passwordHash = await bcrypt.hash(params.password, 12);
  const managerId =
    params.role === "EMPLOYEE"
      ? creator.role === "ADMIN"
        ? creator.id
        : await validateEmployeeManager(params.managerId)
      : null;
  const adminInviteCode = params.role === "ADMIN" ? await generateUniqueAdminInviteCode() : null;

  const user = await prisma.user.create({
    data: {
      email: params.email.toLowerCase(),
      passwordHash,
      fullName: params.fullName,
      role: params.role,
      managerId,
      adminInviteCode
    },
    select: teamUserSelect
  });

  return mapTeamUser(user);
};

export const listUsers = async (requesterId: string) => {
  const requester = await getScopedUserById(requesterId);
  if (!isElevatedRole(requester.role)) {
    throw new AppError("Insufficient permissions.", 403);
  }

  const users = await prisma.user.findMany({
    where:
      requester.role === "SUPERADMIN"
        ? {}
        : {
            role: "EMPLOYEE",
            managerId: requester.id
          },
    select: teamUserSelect
  });

  return users
    .map((user) => mapTeamUser(user))
    .sort((left, right) => roleSortOrder[left.role] - roleSortOrder[right.role] || left.fullName.localeCompare(right.fullName));
};

export const deleteUser = async (params: { userId: string; requesterId: string }) => {
  if (params.userId === params.requesterId) {
    throw new AppError("You cannot delete your own account.", 400);
  }

  await assertCanManageUser(params.requesterId, params.userId);

  const assignedEmployees = await prisma.user.count({
    where: {
      managerId: params.userId,
      role: "EMPLOYEE"
    }
  });

  if (assignedEmployees > 0) {
    throw new AppError("You cannot delete an administrator who still has assigned employees.", 409);
  }

  const existing = await prisma.user.findUnique({
    where: { id: params.userId },
    select: teamUserSelect
  });

  if (!existing) {
    throw new AppError("User not found.", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.workEventEditRequest.deleteMany({
      where: {
        workEvent: {
          userId: params.userId
        }
      }
    });

    await tx.workEvent.deleteMany({
      where: {
        userId: params.userId
      }
    });

    await tx.workEventEditRequest.deleteMany({
      where: {
        requestedById: params.userId
      }
    });

    await tx.workEventEditRequest.updateMany({
      where: {
        reviewedById: params.userId
      },
      data: {
        reviewedById: null
      }
    });

    await tx.workEvent.updateMany({
      where: {
        modifiedById: params.userId
      },
      data: {
        modifiedById: null
      }
    });

    await tx.user.updateMany({
      where: {
        managerId: params.userId
      },
      data: {
        managerId: null
      }
    });

    await tx.user.delete({
      where: {
        id: params.userId
      }
    });
  });

  await deleteStoredProfilePhoto(existing.profilePhotoPath);

  return mapTeamUser(existing);
};

export const assignEmployeeManager = async (params: {
  userId: string;
  managerId: string;
  requesterId: string;
}) => {
  const requester = await getScopedUserById(params.requesterId);
  if (requester.role !== "SUPERADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const target = await prisma.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      role: true
    }
  });

  if (!target) {
    throw new AppError("User not found.", 404);
  }

  if (target.role !== "EMPLOYEE") {
    throw new AppError("Only employees can be reassigned.", 400);
  }

  const managerId = await validateEmployeeManager(params.managerId);

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: {
      managerId
    },
    select: teamUserSelect
  });

  return mapTeamUser(updated);
};

export const updateUserProfilePhoto = async (params: {
  requesterId: string;
  targetUserId: string;
  file: Express.Multer.File;
}) => {
  if (params.requesterId !== params.targetUserId) {
    await assertCanManageUser(params.requesterId, params.targetUserId);
  }

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: teamUserSelect
  });

  if (!target) {
    throw new AppError("User not found.", 404);
  }

  const newPhotoPath = await saveProfilePhotoFile(params.file);

  try {
    const updated = await prisma.user.update({
      where: { id: params.targetUserId },
      data: {
        profilePhotoPath: newPhotoPath
      },
      select: teamUserSelect
    });

    await deleteStoredProfilePhoto(target.profilePhotoPath);

    return mapTeamUser(updated);
  } catch (error) {
    await deleteStoredProfilePhoto(newPhotoPath);
    throw error;
  }
};

export const removeUserProfilePhoto = async (params: { requesterId: string; targetUserId: string }) => {
  if (params.requesterId !== params.targetUserId) {
    await assertCanManageUser(params.requesterId, params.targetUserId);
  }

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: teamUserSelect
  });

  if (!target) {
    throw new AppError("User not found.", 404);
  }

  const updated = await prisma.user.update({
    where: { id: params.targetUserId },
    data: {
      profilePhotoPath: null
    },
    select: teamUserSelect
  });

  await deleteStoredProfilePhoto(target.profilePhotoPath);

  return mapTeamUser(updated);
};

export const getUserProfilePhotoFile = async (params: { requesterId: string; targetUserId: string }): Promise<string> => {
  await assertCanViewUser(params.requesterId, params.targetUserId);

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: {
      profilePhotoPath: true
    }
  });

  if (!target?.profilePhotoPath) {
    throw new AppError("User not found.", 404);
  }

  const absolutePath = resolveStoredProfilePhotoAbsolutePath(target.profilePhotoPath);
  if (!absolutePath) {
    throw new AppError("User not found.", 404);
  }

  try {
    await access(absolutePath);
  } catch {
    throw new AppError("User not found.", 404);
  }

  return absolutePath;
};
