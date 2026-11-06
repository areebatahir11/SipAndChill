-- One business per name (ignoring case, spaces, punctuation and "&" vs "and"). See businessNameKey() in src/lib/platform/names.mjs.
-- Existing rows are backfilled; if two existing businesses already share a name, only the oldest gets the key (the others stay NULL
-- and keep working), so this migration cannot fail on legacy data.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "nameKey" TEXT;
ALTER TABLE "SignupRequest" ADD COLUMN "nameKey" TEXT;

-- Backfill
UPDATE "Tenant" AS t
SET "nameKey" = k."key"
FROM (
  SELECT id,
         regexp_replace(replace(lower(name), '&', 'and'), '[^[:alnum:]]+', '', 'g') AS "key",
         row_number() OVER (
           PARTITION BY regexp_replace(replace(lower(name), '&', 'and'), '[^[:alnum:]]+', '', 'g')
           ORDER BY "createdAt", id
         ) AS rn
  FROM "Tenant"
) AS k
WHERE t.id = k.id AND k.rn = 1 AND k."key" <> '';

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_nameKey_key" ON "Tenant"("nameKey");
CREATE INDEX "SignupRequest_nameKey_idx" ON "SignupRequest"("nameKey");
