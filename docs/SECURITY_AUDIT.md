# Pre-launch security & robustness audit

Scope: the existing Version 1 features only. No new features were added.
Method: read of the auth/session/guard code, every API route, all services (orders, payments, inventory, menu, users, settings, platform, tenants), all validation schemas, the Prisma schema, seed, SMTP, dashboard SQL and the print pages; automated checks (`npm test`, 28 tests, plus mutation checks that confirm the tests fail when a rule is broken).

## What was already good (no change needed)
- Passwords: bcrypt cost 12; same-time answer for unknown email (dummy hash); 10-72 characters with a letter and a number.
- Sessions: random 256-bit token, only its SHA-256 stored, `httpOnly` + `sameSite=lax` + `secure` in production, revoked on password change/reset/deactivation/suspension; permissions are read from the database on every request, so a role change applies immediately.
- Every API handler is wrapped in `handle()` and calls `requireApi` / `requirePlatformApi` (now enforced by a test, handler by handler); state-changing requests check the Origin header (CSRF).
- Tenant isolation: `tenantId` always comes from the session; every read/update/delete goes through a tenant-scoped lookup first; cashiers only see their own orders.
- Money: integer paisa, prices read from the database (never from the browser), one transaction per sale, `UPDATE ... WHERE stock >= need` so stock cannot go negative, idempotency key against duplicate submits, item snapshots.
- No `dangerouslySetInnerHTML`/`eval`; the only raw SQL (dashboard) uses parameterised tagged templates.
- Logo upload: type detected from file bytes (SVG refused), 300 KB cap, platform-admin only.
- Account lock (5 wrong passwords = 15 min), password-recovery codes hashed, 10-minute expiry, 5 tries, cooldown and hourly cap stored in the database.

## Fixed in this pass
| # | Problem | Fix |
|---|---|---|
| 1 | **Order search crash:** typing a 10-digit number in "Order number" made the database reject the value (order numbers are 32-bit) and the page showed an error. | `modules/orders/service.js`: numbers above the limit simply match nothing. |
| 2 | **Giant order crash:** the validators allow price 9,999,999 x quantity 999 x 60 lines, which is larger than the DECIMAL(12,2) column, so confirming such an order ended in a generic 500 after work was done. | Clear 400 "order total is too large" before saving (`MAX_MINOR` in `lib/money.mjs`). |
| 3 | **Silent rounding:** price `12.345` was stored as `12.35`, price `0.004` as `0.00`, recipe quantity `0.0004` as `0` (a recipe that uses nothing). | Validation now refuses more than 2 decimals for money and 3 for quantities (`lib/validation/*`). |
| 4 | **Database errors became 500s:** number out of range, record already deleted, still-in-use record, validation errors from the database layer. | `handle()` maps them to 400/404/409 with plain messages and no internal detail (`lib/db/prisma-failure.mjs`). Real outages are still logged and answered with a generic 500. |
| 5 | **No limit on sign-in attempts per network:** only the per-account lock existed, so one address could try many different accounts. | 30 attempts / 10 min / address on `/api/auth/login`. |
| 6 | **No security headers.** | New `next.config.mjs`: `nosniff`, frame protection, referrer policy, HSTS, permissions policy (**`usb` and `serial` stay allowed for the receipt printer**), no `X-Powered-By`. |
| 7 | **Forced password change could be skipped on the receipt pages** (the APIs already refused it). | `(print)/layout.js` redirects such users. |
| 8 | **Logo upload read the whole body before checking its size.** | Declared length is checked first (413). |
| 9 | **No friendly error screens.** | `app/error.js`, `app/not-found.js` (no technical text; details stay in the server log). |
| 10 | **`.env.example` contained a real database host/project id, a real email address and a hint of the database password.** | Replaced with placeholders. |

## Needs YOUR action (not code)
1. **Rotate the database password and the Gmail app password today.** The password hint in `.env` / `.env.example` and the real project id were in the zip that was shared. Treat them as exposed. Then delete the comment lines that contain password hints from your own `.env`.
2. **Decide about public signup (`/signup`, `/api/auth/signup`).** Anyone can create a business and a free trial. If only PearlSolutions should add clients at launch, remove the signup link/route or put it behind a switch. (Left as is because it is an existing feature and a business decision.)
3. Re-run `prisma/supabase-rls.sql` after the last migration (it covers every table, including the newer ones) and keep the Supabase `anon` key out of the project.
4. Run `npm audit` and a full `npm run build` on a machine with internet before deploying (not possible in the audit environment).

## Known limitations (low risk, consider after launch)
- The in-memory rate limiter (login, signup, password reset requests) is per server instance; on serverless hosting it is best-effort. The database-backed account lock and recovery-code limits are the real protection. A shared limiter (e.g. Upstash Redis) would make it exact.
- No `Content-Security-Policy` yet (needs a nonce setup with Next.js; do it as a separate, tested change).
- Public signup and "create staff" say "an account with this email already exists", and a locked account answers differently from a wrong password: both reveal that an email is registered. Accepted UX trade-off; revisit if it matters.
- Anyone who knows an email can lock that account for 15 minutes with 5 wrong passwords (standard trade-off of account lockout).
- Password-recovery emails still say "Sip & Chill" in the subject/body for every business (branding, not security).
- Stock quantities are compared as JS numbers rounded to 3 decimals (fine for quantities; money never uses floats).

## Not executed in this audit
Database-dependent behaviour could not be run here (no database, no network, no `node_modules`): the order transaction and rollback, duplicate-request handling, tenant isolation with two real tenants, the dashboard SQL, and `next build`. Run the smoke checklist below on staging before opening the shop.

### Launch smoke checklist (15 minutes)
1. Log in as Owner, Manager, Cashier, Inventory Staff; each lands on its own page; a cashier opening `/staff` or `/settings` is redirected.
2. Create two test businesses; with business A logged in, open an order/product/ingredient id of business B in the URL and in `/api/...`: must be 404.
3. Sell an item with a recipe: stock drops by the recipe amount, one stock movement per ingredient. Sell more than stock allows: refused, nothing saved.
4. Press "Confirm" twice quickly / retry with the same request: one order only.
5. Pay Rs 1,000 on Rs 850: change Rs 150, status Paid. Pay Rs 500: Partially paid, outstanding Rs 350; add the rest later.
6. Cancel an order with and without restock; dashboard excludes it.
7. Print on the real thermal printer (58 and 80 mm) and with the browser dialog.
8. Upload the PearlSolutions/client logo in `/platform`; confirm it shows in the shop sidebar.
9. Type `9999999999` in the order search: "No orders found", no error page.
10. In the browser developer tools, check the response headers of any page for `X-Content-Type-Options` and `Permissions-Policy`.
