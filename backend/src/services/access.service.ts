import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";

const scopedUserSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  managerId: true,
  isActive: true
} satisfies Prisma.UserSelect;

export type ScopedUser = Prisma.UserGetPayload<{ select: typeof scopedUserSelect }>;

type ScopeOptions = {
  includeSelf?: boolean;
  employeesOnly?: boolean;
};

export const getScopedUserById = async (userId: string): Promise<ScopedUser> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: scopedUserSelect
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return user;
};

export const isElevatedRole = (role: Role): boolean => role === "ADMIN" || role === "SUPERADMIN";

export const canViewUser = (requester: ScopedUser, target: Pick<ScopedUser, "id" | "role" | "managerId">): boolean => {
  if (requester.role === "SUPERADMIN") {
    return true;
  }

  if (requester.role === "ADMIN") {
    return target.id === requester.id || (target.role === "EMPLOYEE" && target.managerId === requester.id);
  }

  return target.id === requester.id;
};

export const canManageUser = (requester: ScopedUser, target: Pick<ScopedUser, "id" | "role" | "managerId">): boolean => {
  if (requester.role === "SUPERADMIN") {
    return true;
  }

  if (requester.role === "ADMIN") {
    return target.id === requester.id || (target.role === "EMPLOYEE" && target.managerId === requester.id);
  }

  return false;
};

export const assertCanViewUser = async (requesterId: string, targetUserId: string): Promise<ScopedUser> => {
  const [requester, target] = await Promise.all([getScopedUserById(requesterId), getScopedUserById(targetUserId)]);

  if (!canViewUser(requester, target)) {
    throw new AppError("Insufficient permissions.", 403);
  }

  return target;
};

export const assertCanManageUser = async (requesterId: string, targetUserId: string): Promise<{
  requester: ScopedUser;
  target: ScopedUser;
}> => {
  const [requester, target] = await Promise.all([getScopedUserById(requesterId), getScopedUserById(targetUserId)]);

  if (!canManageUser(requester, target)) {
    throw new AppError("Insufficient permissions.", 403);
  }

  return { requester, target };
};

export const buildVisibleUsersWhere = (requester: ScopedUser, options?: ScopeOptions): Prisma.UserWhereInput => {
  const includeSelf = options?.includeSelf ?? true;
  const employeesOnly = options?.employeesOnly ?? false;

  if (requester.role === "SUPERADMIN") {
    if (employeesOnly) {
      return { role: "EMPLOYEE" };
    }

    return {};
  }

  if (requester.role === "ADMIN") {
    if (employeesOnly) {
      return {
        role: "EMPLOYEE",
        managerId: requester.id
      };
    }

    if (includeSelf) {
      return {
        OR: [
          { id: requester.id },
          {
            role: "EMPLOYEE",
            managerId: requester.id
          }
        ]
      };
    }

    return {
      role: "EMPLOYEE",
      managerId: requester.id
    };
  }

  return {
    id: requester.id
  };
};

export const listVisibleUsers = async (requesterId: string, options?: ScopeOptions): Promise<ScopedUser[]> => {
  const requester = await getScopedUserById(requesterId);

  return prisma.user.findMany({
    where: buildVisibleUsersWhere(requester, options),
    select: scopedUserSelect,
    orderBy: [{ fullName: "asc" }]
  });
};

export const listVisibleUserIds = async (requesterId: string, options?: ScopeOptions): Promise<string[]> => {
  const users = await listVisibleUsers(requesterId, options);
  return users.map((user) => user.id);
};
