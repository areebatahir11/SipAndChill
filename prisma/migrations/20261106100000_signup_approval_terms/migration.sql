-- Signup with email verification + approval, and Terms & Conditions acceptance.
-- Additive only: existing businesses keep working (status defaults to 'ACTIVE').

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "SignupRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sendCount" INTEGER NOT NULL DEFAULT 1,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "lastSentAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignupRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignupRequest_email_key" ON "SignupRequest"("email");
CREATE INDEX "SignupRequest_ipAddress_updatedAt_idx" ON "SignupRequest"("ipAddress", "updatedAt");
CREATE INDEX "SignupRequest_expiresAt_idx" ON "SignupRequest"("expiresAt");
CREATE UNIQUE INDEX "TermsAcceptance_userId_version_key" ON "TermsAcceptance"("userId", "version");
CREATE INDEX "TermsAcceptance_tenantId_idx" ON "TermsAcceptance"("tenantId");

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase: new tables must be locked against the public REST API. Re-run prisma/supabase-rls.sql after migrating.
