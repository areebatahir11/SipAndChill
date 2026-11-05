-- Step 4: PearlSolutions platform layer.

-- Platform sessions have no tenant membership.
ALTER TABLE "Session" ALTER COLUMN "membershipId" DROP NOT NULL;

-- PearlSolutions staff flag.
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Per-client billing.
ALTER TABLE "Tenant"
  ADD COLUMN "billingStatus" TEXT NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN "monthlyFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "dueDate" TIMESTAMP(3),
  ADD COLUMN "lastPaidAt" TIMESTAMP(3),
  ADD COLUMN "internalNote" TEXT;
