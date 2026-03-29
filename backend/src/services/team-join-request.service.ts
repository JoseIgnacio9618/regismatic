import { Prisma, TeamJoinRequestStatus, type NotificationType } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";
import { nowUtc } from "../utils/dates";
import { createNotificationsForUsers } from "./notification.service";
import { getScopedUserById } from "./access.service";
import { assertAdminSeatAvailability } from "./billing.service";
import { buildProfilePhotoApiPath } from "./profile-photo.service";

const teamJoinRequestSelect = {
  id: true,
  inviteCodeUsed: true,
  status: true,
  message: true,
  reviewComment: true,
  reviewedAt: true,
  createdAt: true,
  employee: {
    select: {
      id: true,
      fullName: true,
      email: true,
      profilePhotoPath: true,
      managerId: true
    }
  },
  targetManager: {
    select: {
      id: true,
      fullName: true,
      email: true
    }
  },
  reviewedBy: {
    select: {
      id: true,
      fullName: true,
      email: true
    }
  }
} satisfies Prisma.TeamJoinRequestSelect;

type TeamJoinRequestRecord = Prisma.TeamJoinRequestGetPayload<{ select: typeof teamJoinRequestSelect }>;

const mapJoinRequest = (request: TeamJoinRequestRecord) => ({
  id: request.id,
  inviteCodeUsed: request.inviteCodeUsed,
  status: request.status,
  message: request.message,
  reviewComment: request.reviewComment,
  reviewedAt: request.reviewedAt,
  createdAt: request.createdAt,
  employee: {
    id: request.employee.id,
    fullName: request.employee.fullName,
    email: request.employee.email,
    profilePhotoUrl: buildProfilePhotoApiPath(request.employee.id, request.employee.profilePhotoPath),
    managerId: request.employee.managerId
  },
  targetManager: request.targetManager,
  reviewedBy: request.reviewedBy ?? null
});

export type PaginatedTeamJoinRequestsResult = {
  requests: ReturnType<typeof mapJoinRequest>[];
  total: number;
  page: number;
  pageSize: number;
};

const findTargetManagerByInviteCode = async (inviteCode: string) => {
  const manager = await prisma.user.findFirst({
    where: {
      adminInviteCode: inviteCode.trim().toUpperCase(),
      role: "ADMIN",
      isActive: true
    },
    select: {
      id: true,
      fullName: true,
      email: true
    }
  });

  if (!manager) {
    throw new AppError("Invalid administrator invite code.", 400);
  }

  return manager;
};

export const createTeamJoinRequestForEmployee = async (params: {
  employeeId: string;
  inviteCode: string;
  message?: string;
}) => {
  const employee = await prisma.user.findUnique({
    where: { id: params.employeeId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      managerId: true,
      isActive: true
    }
  });

  if (!employee || !employee.isActive) {
    throw new AppError("User not found.", 404);
  }

  if (employee.role !== "EMPLOYEE") {
    throw new AppError("Insufficient permissions.", 403);
  }

  if (employee.managerId) {
    throw new AppError("This employee is already assigned to an administrator.", 409);
  }

  const pendingRequest = await prisma.teamJoinRequest.findFirst({
    where: {
      employeeId: employee.id,
      status: "PENDING"
    },
    select: {
      id: true
    }
  });

  if (pendingRequest) {
    throw new AppError("You already have a pending team request.", 409);
  }

  const targetManager = await findTargetManagerByInviteCode(params.inviteCode);

  const request = await prisma.teamJoinRequest.create({
    data: {
      employeeId: employee.id,
      targetManagerId: targetManager.id,
      inviteCodeUsed: params.inviteCode.trim().toUpperCase(),
      message: params.message?.trim() || null
    },
    select: teamJoinRequestSelect
  });

  await createNotificationsForUsers({
    userIds: [targetManager.id],
    type: "TEAM_JOIN_REQUEST_CREATED",
    title: "Nueva solicitud de acceso a equipo",
    body: `${employee.fullName} ha solicitado unirse al equipo de ${targetManager.fullName}.`,
    i18n: {
      titleKey: "notifications.team_join_created_title",
      bodyKey: "notifications.team_join_created_body",
      params: {
        employee: employee.fullName,
        manager: targetManager.fullName
      }
    },
    metadata: {
      requestId: request.id,
      employeeId: employee.id,
      targetManagerId: targetManager.id,
      route: "/users?workspace=directory&focus=join-requests"
    },
    pushData: {
      requestId: request.id,
      employeeId: employee.id,
      targetManagerId: targetManager.id,
      route: "/users?workspace=directory&focus=join-requests",
      type: "TEAM_JOIN_REQUEST_CREATED"
    }
  });

  return mapJoinRequest(request);
};

export const listTeamJoinRequests = async (params: {
  requesterId: string;
  page?: number;
  pageSize?: number;
  status?: TeamJoinRequestStatus;
}): Promise<PaginatedTeamJoinRequestsResult> => {
  const requester = await getScopedUserById(params.requesterId);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
  const page = Math.max(1, params.page ?? 1);
  const skip = (page - 1) * pageSize;

  const where: Prisma.TeamJoinRequestWhereInput =
    requester.role === "SUPERADMIN"
      ? {}
      : requester.role === "ADMIN"
        ? { targetManagerId: requester.id }
        : { employeeId: requester.id };

  if (params.status) {
    where.status = params.status;
  }

  const [total, requests] = await prisma.$transaction([
    prisma.teamJoinRequest.count({ where }),
    prisma.teamJoinRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      select: teamJoinRequestSelect,
      skip,
      take: pageSize
    })
  ]);

  return {
    requests: requests.map((request) => mapJoinRequest(request)),
    total,
    page,
    pageSize
  };
};

export const reviewTeamJoinRequest = async (params: {
  requestId: string;
  requesterId: string;
  action: "APPROVE" | "REJECT";
  reviewComment?: string;
}) => {
  const requester = await getScopedUserById(params.requesterId);
  if (requester.role !== "ADMIN" && requester.role !== "SUPERADMIN") {
    throw new AppError("Insufficient permissions.", 403);
  }

  const existing = await prisma.teamJoinRequest.findUnique({
    where: { id: params.requestId },
    select: {
      id: true,
      status: true,
      employeeId: true,
      targetManagerId: true,
      employee: {
        select: {
          fullName: true,
          managerId: true
        }
      },
      targetManager: {
        select: {
          fullName: true
        }
      }
    }
  });

  if (!existing) {
    throw new AppError("Team join request not found.", 404);
  }

  if (requester.role === "ADMIN" && existing.targetManagerId !== requester.id) {
    throw new AppError("Insufficient permissions.", 403);
  }

  if (existing.status !== "PENDING") {
    throw new AppError("The team join request was already reviewed.", 409);
  }

  if (params.action === "APPROVE" && existing.employee.managerId && existing.employee.managerId !== existing.targetManagerId) {
    throw new AppError("This employee is already assigned to an administrator.", 409);
  }

  if (params.action === "APPROVE") {
    await assertAdminSeatAvailability({
      adminId: existing.targetManagerId,
      requesterRole: requester.role
    });
  }

  const reviewedAt = nowUtc();

  const request = await prisma.$transaction(async (tx) => {
    if (params.action === "APPROVE") {
      await tx.user.update({
        where: {
          id: existing.employeeId
        },
        data: {
          managerId: existing.targetManagerId
        }
      });

      await tx.teamJoinRequest.updateMany({
        where: {
          employeeId: existing.employeeId,
          status: "PENDING",
          id: {
            not: existing.id
          }
        },
        data: {
          status: "REJECTED",
          reviewedById: params.requesterId,
          reviewedAt,
          reviewComment: "Auto-closed after another request was approved."
        }
      });
    }

    return tx.teamJoinRequest.update({
      where: { id: existing.id },
      data: {
        status: params.action === "APPROVE" ? TeamJoinRequestStatus.APPROVED : TeamJoinRequestStatus.REJECTED,
        reviewComment: params.reviewComment?.trim() || null,
        reviewedById: params.requesterId,
        reviewedAt
      },
      select: teamJoinRequestSelect
    });
  });

  const notificationType: NotificationType =
    params.action === "APPROVE" ? "TEAM_JOIN_REQUEST_APPROVED" : "TEAM_JOIN_REQUEST_REJECTED";

  await createNotificationsForUsers({
    userIds: [existing.employeeId],
    type: notificationType,
    title: params.action === "APPROVE" ? "Solicitud de equipo aprobada" : "Solicitud de equipo rechazada",
    body:
      params.action === "APPROVE"
        ? `${existing.targetManager.fullName} ha aceptado tu solicitud para unirte a su equipo.`
        : `${existing.targetManager.fullName} ha rechazado tu solicitud para unirte a su equipo.`,
    i18n:
      params.action === "APPROVE"
        ? {
            titleKey: "notifications.team_join_approved_title",
            bodyKey: "notifications.team_join_approved_body",
            params: {
              manager: existing.targetManager.fullName
            }
          }
        : {
            titleKey: "notifications.team_join_rejected_title",
            bodyKey: "notifications.team_join_rejected_body",
            params: {
              manager: existing.targetManager.fullName
            }
          },
    metadata: {
      requestId: existing.id,
      action: params.action,
      route: "/dashboard"
    },
    pushData: {
      requestId: existing.id,
      action: params.action,
      route: "/dashboard",
      type: notificationType
    }
  });

  return mapJoinRequest(request);
};
