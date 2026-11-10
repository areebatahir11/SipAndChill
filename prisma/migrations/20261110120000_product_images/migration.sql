-- Menu item pictures. Bytes live in their own table so listing the menu never loads them.
CREATE TABLE "ProductImage" (
    "productId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("productId")
);

CREATE INDEX "ProductImage_tenantId_idx" ON "ProductImage"("tenantId");

ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safety net: the app already refuses big pictures; the database refuses them too (150 KB).
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_size_limit" CHECK (octet_length("data") BETWEEN 1 AND 153600);

-- Lock the new table against Supabase's public REST API.
ALTER TABLE "ProductImage" ENABLE ROW LEVEL SECURITY;
