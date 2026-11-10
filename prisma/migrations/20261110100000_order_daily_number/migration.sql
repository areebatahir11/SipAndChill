-- Per-day order numbers: #1 restarts every business day (Asia/Karachi). The lifetime "orderNo" is kept as-is.

-- 1. New columns (nullable while we backfill).
ALTER TABLE "Order" ADD COLUMN "businessDate" DATE;
ALTER TABLE "Order" ADD COLUMN "dailyNo" INTEGER;

-- 2. Backfill every existing order: its Pakistan-time calendar day, numbered 1,2,3... in the order it was taken that day.
UPDATE "Order" o
SET "businessDate" = r.bd, "dailyNo" = r.rn
FROM (
  SELECT "id",
         (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')::date AS bd,
         ROW_NUMBER() OVER (
           PARTITION BY "tenantId", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Karachi')::date
           ORDER BY "orderNo"
         )::int AS rn
  FROM "Order"
) r
WHERE o."id" = r."id";

-- 3. Lock it down.
ALTER TABLE "Order" ALTER COLUMN "businessDate" SET NOT NULL;
ALTER TABLE "Order" ALTER COLUMN "dailyNo" SET NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_dailyNo_positive" CHECK ("dailyNo" >= 1);

CREATE UNIQUE INDEX "Order_tenantId_businessDate_dailyNo_key" ON "Order"("tenantId", "businessDate", "dailyNo");
CREATE INDEX "Order_tenantId_businessDate_idx" ON "Order"("tenantId", "businessDate");
