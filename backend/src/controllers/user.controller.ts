import type { Request, Response } from "express";
import { z } from "zod";
import { TeamJoinRequestStatus } from "@prisma/client";
import { AppError } from "../middlewares/error.middleware";
import { assertNonBillingFeatureAccessForUser } from "../services/billing.service";
import {
  assignEmployeeManager,
  createUser,
  deleteUser,
  getUserProfilePhotoFile,
  impersonateUserSession,
  listUsers,
  removeUserProfilePhoto,
  resetUserPassword,
  updateUserProfilePhoto
} from "../services/user.service";
import {
  createTeamJoinRequestForEmployee,
  listTeamJoinRequests,
  reviewTeamJoinRequest
} from "../services/team-join-request.service";
import { strictObject } from "../utils/validation";

const paginatedUsersQuerySchema = strictObject({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().optional(),
  role: z.enum(["SUPERADMIN", "ADMIN", "EMPLOYEE"]).optional()
});

const paginatedJoinRequestsQuerySchema = strictObject({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: z.nativeEnum(TeamJoinRequestStatus).optional()
});

const createUserSchema = strictObject({
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

const assignManagerSchema = strictObject({
  managerId: z.string().min(1)
});

const resetUserPasswordSchema = strictObject({
  password: z
    .string()
    .min(10)
    .regex(/[a-z]/, "Password must include lowercase letters.")
    .regex(/[A-Z]/, "Password must include uppercase letters.")
    .regex(/[0-9]/, "Password must include at least one number.")
    .regex(/[^a-zA-Z0-9]/, "Password must include at least one special character.")
});

const createTeamJoinRequestSchema = strictObject({
  inviteCode: z.string().trim().min(3),
  message: z.string().trim().max(300).optional()
});

const reviewTeamJoinRequestSchema = strictObject({
  action: z.enum(["APPROVE", "REJECT"]),
  reviewComment: z.string().trim().max(300).optional()
});

export const createUserController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

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

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const query = paginatedUsersQuerySchema.parse(req.query);
  const result = await listUsers({
    requesterId: req.user.id,
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    role: query.role
  });
  return res.json(result);
};

export const createTeamJoinRequestController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const payload = createTeamJoinRequestSchema.parse(req.body);
  const request = await createTeamJoinRequestForEmployee({
    employeeId: req.user.id,
    inviteCode: payload.inviteCode,
    message: payload.message
  });

  return res.status(201).json(request);
};

export const listTeamJoinRequestsController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const query = paginatedJoinRequestsQuerySchema.parse(req.query);
  const result = await listTeamJoinRequests({
    requesterId: req.user.id,
    page: query.page,
    pageSize: query.pageSize,
    status: query.status
  });
  return res.json(result);
};

export const reviewTeamJoinRequestController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const payload = reviewTeamJoinRequestSchema.parse(req.body);
  const requestId = z.string().min(1).parse(req.params.requestId);
  const request = await reviewTeamJoinRequest({
    requestId,
    requesterId: req.user.id,
    action: payload.action,
    reviewComment: payload.reviewComment
  });

  return res.json(request);
};

export const deleteUserController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  await assertNonBillingFeatureAccessForUser(req.user.id);

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

  await assertNonBillingFeatureAccessForUser(req.user.id);

  const payload = assignManagerSchema.parse(req.body);
  const userId = z.string().min(1).parse(req.params.userId);
  const user = await assignEmployeeManager({
    userId,
    managerId: payload.managerId,
    requesterId: req.user.id
  });

  return res.json(user);
};

export const resetUserPasswordController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const payload = resetUserPasswordSchema.parse(req.body);
  const userId = z.string().min(1).parse(req.params.userId);
  const user = await resetUserPassword({
    requesterId: req.user.id,
    targetUserId: userId,
    password: payload.password
  });

  return res.json(user);
};

export const impersonateUserController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const userId = z.string().min(1).parse(req.params.userId);
  const session = await impersonateUserSession({
    requesterId: req.user.id,
    targetUserId: userId
  });

  return res.json(session);
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

export const getUserProfilePhotoController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated.", 401);
  }

  const userId = z.string().min(1).parse(req.params.userId);
  const absolutePath = await getUserProfilePhotoFile({
    requesterId: req.user.id,
    targetUserId: userId
  });

  return res.sendFile(absolutePath);
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
