-- CreateEnum
CREATE TYPE "EditRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "WorkEvent"
ADD COLUMN "modifiedAt" TIMESTAMP(3),
ADD COLUMN "modifiedById" TEXT,
ADD COLUMN "modificationReason" TEXT;

-- CreateTable
CREATE TABLE "WorkEventEditRequest" (
    "id" TEXT NOT NULL,
    "workEventId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedEventAt" TIMESTAMP(3) NOT NULL,
    "requestedNote" TEXT,
    "reason" TEXT NOT NULL,
    "status" "EditRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewComment" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkEventEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkEvent_modifiedById_idx" ON "WorkEvent"("modifiedById");

-- CreateIndex
CREATE INDEX "WorkEventEditRequest_workEventId_status_idx" ON "WorkEventEditRequest"("workEventId", "status");

-- CreateIndex
CREATE INDEX "WorkEventEditRequest_requestedById_createdAt_idx" ON "WorkEventEditRequest"("requestedById", "createdAt");

-- CreateIndex
CREATE INDEX "WorkEventEditRequest_status_createdAt_idx" ON "WorkEventEditRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkEvent"
ADD CONSTRAINT "WorkEvent_modifiedById_fkey" FOREIGN KEY ("modifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEventEditRequest"
ADD CONSTRAINT "WorkEventEditRequest_workEventId_fkey" FOREIGN KEY ("workEventId") REFERENCES "WorkEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEventEditRequest"
ADD CONSTRAINT "WorkEventEditRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkEventEditRequest"
ADD CONSTRAINT "WorkEventEditRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
