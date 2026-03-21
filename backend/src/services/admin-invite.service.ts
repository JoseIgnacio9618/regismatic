import { prisma } from "../config/prisma";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

const randomCode = () => {
  let value = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    const position = Math.floor(Math.random() * ALPHABET.length);
    value += ALPHABET[position];
  }

  return `RGM-${value}`;
};

export const generateUniqueAdminInviteCode = async (): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const inviteCode = randomCode();
    const existing = await prisma.user.findUnique({
      where: {
        adminInviteCode: inviteCode
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return inviteCode;
    }
  }

  throw new Error("Could not generate a unique admin invite code.");
};

export const ensureAdminInviteCode = async (user: {
  id: string;
  role: "SUPERADMIN" | "ADMIN" | "EMPLOYEE";
  adminInviteCode?: string | null;
}) => {
  if ((user.role !== "ADMIN" && user.role !== "SUPERADMIN") || user.adminInviteCode) {
    return user.adminInviteCode ?? null;
  }

  const inviteCode = await generateUniqueAdminInviteCode();
  await prisma.user.update({
    where: {
      id: user.id
    },
    data: {
      adminInviteCode: inviteCode
    }
  });

  return inviteCode;
};
