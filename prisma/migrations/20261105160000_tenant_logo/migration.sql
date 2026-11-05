-- Per-business logo: owner uploads it in Shop Settings. The picture is stored in its own table so that
-- normal Tenant / settings queries never load it; Tenant.logoUpdatedAt is the cache-busting version.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TenantLogo" (
    "tenantId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantLogo_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "TenantLogo" ADD CONSTRAINT "TenantLogo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
