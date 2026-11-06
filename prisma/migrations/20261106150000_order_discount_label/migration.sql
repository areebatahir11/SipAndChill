-- Menu promotions: the order keeps the name of the promotion that discounted it (e.g. "20% OFF") so receipts reprint identically.
-- AlterTable
ALTER TABLE "Order" ADD COLUMN "discountLabel" TEXT;
