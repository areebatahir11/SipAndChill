-- Receipt print tracking (browser printing).
-- A web page cannot know whether paper really came out of the printer, so this only records what is genuinely known:
--   NOT_REQUESTED : nobody opened the print dialog for this order
--   DIALOG_OPENED : the print dialog was opened; the outcome is unknown until the cashier confirms
--   CONFIRMED     : the cashier confirmed the receipt came out
--   PROBLEM       : the receipt page / dialog could not be opened, or the cashier said it did not print
-- Only these columns are ever touched by printing: totals, payments and stock are never changed by a (re)print.
-- Existing orders start as NOT_REQUESTED (additive, nullable-free defaults: safe on live data).

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "printStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED';
ALTER TABLE "Order" ADD COLUMN "printAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "lastPrintAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "printConfirmedAt" TIMESTAMP(3);

-- Cheap lookup of "receipts that need attention" for one business.
CREATE INDEX "Order_tenantId_printStatus_lastPrintAt_idx" ON "Order"("tenantId", "printStatus", "lastPrintAt");
