-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_JOIN_REQUEST_CREATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_JOIN_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'TEAM_JOIN_REQUEST_REJECTED';

-- CreateEnum
CREATE TYPE "TeamJoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "adminInviteCode" TEXT;

-- CreateTable
CREATE TABLE "TeamJoinRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "targetManagerId" TEXT NOT NULL,
    "inviteCodeUsed" TEXT NOT NULL,
    "status" "TeamJoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewComment" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamJoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_adminInviteCode_key" ON "User"("adminInviteCode");

-- CreateIndex
CREATE INDEX "TeamJoinRequest_employeeId_createdAt_idx" ON "TeamJoinRequest"("employeeId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamJoinRequest_targetManagerId_status_createdAt_idx" ON "TeamJoinRequest"("targetManagerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TeamJoinRequest_status_createdAt_idx" ON "TeamJoinRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TeamJoinRequest_reviewedById_idx" ON "TeamJoinRequest"("reviewedById");

-- AddForeignKey
ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_targetManagerId_fkey" FOREIGN KEY ("targetManagerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamJoinRequest" ADD CONSTRAINT "TeamJoinRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
