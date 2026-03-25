ALTER TABLE "BillingSubscription"
ADD COLUMN "customSeatLimit" INTEGER,
ADD COLUMN "customSeatLimitUpdatedAt" TIMESTAMP(3),
ADD COLUMN "customSeatLimitUpdatedById" TEXT;
