# Usage Analytics (PearlSolutions side)

Platform admin only. Shows which clients sign in, how often, and which features they use.

Screens: `/platform/usage` (all clients) and the "Usage" section of `/platform/clients/:id`.
APIs: `GET /api/platform/usage?days=7|30|90` and `GET /api/platform/clients/:id/usage?days=7|30|90` (`requirePlatformApi`).

## Where the numbers come from (nothing new is stored)
| Number | Source |
|---|---|
| Sign-ins, per day, per client | `AuditLog` action `auth.login` (already written on every sign-in) |
| People who signed in / last sign-in | `User.lastLoginAt` through `Membership` |
| Take Orders, Orders & Receipts, Expenses, Stock, Stock purchases, Suppliers, My Team, Shop Settings & pictures | `AuditLog` actions the app already writes (list in `src/lib/platform/usage.mjs`) |
| Receipt printing, Discounts | counts on `Order` (`printAttempts > 0`, `discount > 0`) |
| Online payments | count of `Payment` rows whose method is not `CASH` |

Past usage appears immediately because the data already exists. No migration, no RLS change, no tracking code in the shop screens.

## Privacy rule (kept from the rest of the platform code)
COUNTS ONLY. No amounts, prices, product or customer names, notes or audit `metadata` are ever selected
(`tests/platform-usage.test.mjs` fails if `modules/platform/usage.js` starts reading them).
Only actions listed in `USAGE_FEATURES` are read, so PearlSolutions' own actions (`platform.*`, `menu.imported`) never count as client usage.

## Limits to know
- It measures what staff DID (orders taken, expenses added...), not which screens they only opened. Sales Summary, Menu and Categories views are not recorded by the app.
- Audit writes are best-effort in the existing code (a failed write is logged, never blocks the action), so counts can be very slightly low.
- Status: Active = something happened in the last 7 days, Quiet = 8 to 30 days, Inactive = more than 30, Never used = no sign-in ever.

## When the data grows
The page is fast at current size. If `AuditLog` passes roughly a million rows, add this (safe, additive) migration:

    CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog" ("action", "createdAt");
    -- and in schema.prisma, model AuditLog:  @@index([action, createdAt])
