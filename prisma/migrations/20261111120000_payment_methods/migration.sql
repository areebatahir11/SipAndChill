-- Payment methods: cash plus JazzCash, Easypaisa and bank transfer, with an optional transaction ID for the online ones.
-- Safe for existing data: every payment saved so far is cash, so it has no reference and passes both checks.

ALTER TABLE "Payment" ADD COLUMN "reference" TEXT;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_method_valid"
  CHECK ("method" IN ('CASH', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER'));

-- Cash never has a transaction ID. An online payment may have none (NULL), or an ID of 4-40 characters.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reference_rule"
  CHECK (
    ("method" = 'CASH' AND "reference" IS NULL)
    OR ("method" <> 'CASH' AND ("reference" IS NULL OR length("reference") BETWEEN 4 AND 40))
  );

-- A transaction ID that is given can be used only once per shop and method (stops one transfer paying two orders).
-- NULLs count as different in PostgreSQL, so cash and online payments without an ID never clash.
CREATE UNIQUE INDEX "Payment_tenantId_method_reference_key" ON "Payment"("tenantId", "method", "reference");
