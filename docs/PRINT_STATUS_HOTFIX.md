# Print-status hotfix (live version: direct USB printing + auto-print stay as they are)

What changed: the result of every receipt print is saved on the order, so a failure is still visible after the order dialog is closed.
What did NOT change: WebUSB / Web Serial printing, Zadig/WinUSB help, the "blocked printer -> print window" fallback, auto-print after "Confirm order", paper cut, cash drawer, receipt layout, promotions / discount label.

## Database commands (read this before running anything)
- **Never run `npx prisma migrate dev` or `migrate reset` while `.env` points at the production Supabase database.** They are development commands: they compare the schema with the database and may ask to drop columns or reset the whole schema (data loss).
- Production uses only: `npx prisma migrate deploy` (applies pending migrations, never drops anything), then `npx prisma generate`.
- Check: `npx prisma migrate status` must say "Database schema is up to date!".
- This hotfix adds ONE migration, `20261107100000_order_print_status` (4 new columns with defaults + 1 index). It is additive: the previous code keeps working on the migrated database. It may already be applied.

## Deploy order
1. `npx prisma migrate deploy` (no-op if already applied), `npx prisma generate`.
2. `npm test` / `npm run build` locally.
3. Push the code (Vercel deploys). Do NOT deploy the code before the migration exists in the database.
4. Counter laptop: make one sale (receipt prints by itself) -> Orders & Receipts shows "Sent to printer".
5. Failure test: unplug the printer USB cable, sell once -> banner "1 receipt did not print" appears, and stays after "New order" and after a refresh; plug in, press "Print again" -> the banner disappears.

## Rollback
Redeploy the previous version; the migration is additive and the old code ignores the new columns.
