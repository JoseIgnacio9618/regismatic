import type { Notification, NotificationType, PushPlatform, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AppError } from "../middlewares/error.middleware";
import { nowUtc } from "../utils/dates";
import { sendPushToTokens } from "./push.service";

type UserSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type UserNotificationRecord = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
};

export type UserNotificationsResult = {
  notifications: UserNotificationRecord[];
  unreadCount: number;
};

type ListNotificationsParams = {
  userId: string;
  limit?: number;
  unreadOnly?: boolean;
};

type CreateNotificationsParams = {
  userIds: string[];
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
  pushData?: Record<string, unknown>;
};

const toUserNotificationRecord = (notification: Notification): UserNotificationRecord => ({
  id: notification.id,
  type: notification.type,
  title: notification.title,
  body: notification.body,
  metadata: (notification.metadata as Record<string, unknown> | null) ?? null,
  isRead: notification.isRead,
  readAt: notification.readAt,
  createdAt: notification.createdAt
});

export const listNotifications = async (params: ListNotificationsParams): Promise<UserNotificationsResult> => {
  const take = Math.min(50, Math.max(1, params.limit ?? 20));

  const where: Prisma.NotificationWhereInput = {
    userId: params.userId,
    ...(params.unreadOnly ? { isRead: false } : {})
  };

  const [notifications, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take
    }),
    prisma.notification.count({
      where: {
        userId: params.userId,
        isRead: false
      }
    })
  ]);

  return {
    notifications: notifications.map((notification) => toUserNotificationRecord(notification)),
    unreadCount
  };
};

export const markNotificationAsRead = async (userId: string, notificationId: string): Promise<void> => {
  const result = await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId
    },
    data: {
      isRead: true,
      readAt: nowUtc()
    }
  });

  if (result.count === 0) {
    throw new AppError("Notification not found.", 404);
  }
};

export const markAllNotificationsAsRead = async (userId: string): Promise<number> => {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false
    },
    data: {
      isRead: true,
      readAt: nowUtc()
    }
  });

  return result.count;
};

export const registerPushToken = async (params: {
  userId: string;
  token: string;
  platform: PushPlatform;
}): Promise<void> => {
  const token = params.token.trim();
  if (token.length < 10) {
    throw new AppError("Invalid push token.", 400);
  }

  await prisma.pushDeviceToken.upsert({
    where: {
      token
    },
    update: {
      userId: params.userId,
      platform: params.platform,
      isActive: true,
      lastSeenAt: nowUtc()
    },
    create: {
      userId: params.userId,
      token,
      platform: params.platform
    }
  });
};

export const createNotificationsForUsers = async (params: CreateNotificationsParams): Promise<void> => {
  const uniqueUserIds = Array.from(new Set(params.userIds.filter((userId) => userId.length > 0)));
  if (uniqueUserIds.length === 0) {
    return;
  }

  const now = nowUtc();

  await prisma.notification.createMany({
    data: uniqueUserIds.map((userId) => ({
      userId,
      type: params.type,
      title: params.title,
      body: params.body,
      metadata: params.metadata as Prisma.InputJsonValue | undefined,
      createdAt: now
    }))
  });

  const deviceTokens = await prisma.pushDeviceToken.findMany({
    where: {
      userId: { in: uniqueUserIds },
      isActive: true
    },
    select: {
      token: true
    }
  });

  if (deviceTokens.length === 0) {
    return;
  }

  let pushResult:
    | {
        invalidTokens: string[];
      }
    | null = null;

  try {
    pushResult = await sendPushToTokens(
      deviceTokens.map((deviceToken) => deviceToken.token),
      {
        title: params.title,
        body: params.body,
        data: params.pushData ?? params.metadata
      }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Push dispatch failed. In-app notification persisted successfully.", error);
    return;
  }

  if (pushResult && pushResult.invalidTokens.length > 0) {
    await prisma.pushDeviceToken.updateMany({
      where: {
        token: { in: pushResult.invalidTokens }
      },
      data: {
        isActive: false
      }
    });
  }
};

export const listAdminUsers = async (): Promise<UserSummary[]> => {
  return prisma.user.findMany({
    where: {
      role: "ADMIN",
      isActive: true
    },
    select: {
      id: true,
      fullName: true,
      email: true
    }
  });
};
