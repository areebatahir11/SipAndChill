# Sip&Chill Admin: PearlSolutions multi-tenant POS & inventory

Next.js (App Router) + Tailwind CSS v4 + Prisma/PostgreSQL. First client: Sip & Chill.

## Setup
1. `cp .env.example .env` and fill `DATABASE_URL`, `DIRECT_URL`, `SEED_PLATFORM_*` (Supabase or local PostgreSQL).
2. `npm install` (also runs `prisma generate`)
3. `npx prisma migrate dev`
4. Supabase only: run `prisma/supabase-rls.sql` in the SQL Editor.
5. Run `npm run db:seed`, then `npm run dev` and open http://localhost:3000
6. `npm test` runs the unit tests (`tests/core-rules.test.mjs`: money/payments, permissions, date ranges, recipes, receipt model, logo rules, security headers, API guards).

## Folder structure
```
src/
  app/
    (auth)/login          public login page
    (dashboard)/          business shell (layout = auth guard + sidebar); one folder per module
    (print)/              sidebar-free pages for printing (receipt)
    (platform)/platform/  PearlSolutions super-admin area: dashboard, clients, client detail, account
    api/                  thin REST route handlers (validate -> service)
  components/
    ui/                   Tailwind primitives: Button, Card, Field, Modal, Pill, Alert, DataTable...
    layout/               Sidebar, AuthProvider, ModulePending
  features/<module>/      UI for one module (staff, settings, account, auth, pos, orders, receipt, dashboard)
  modules/<module>/       server business logic (services), tenant-scoped
  modules/platform/       cross-tenant logic for PearlSolutions only (clients, overview)
  lib/                    auth, permissions, validation (zod), http helpers, db client, api-client
prisma/                   schema, migrations, seed
```
Rules: pages are server components that call `requirePage(permission)` then render a feature component.
API handlers call `requireApi(request, permission)`, parse with zod, and delegate to `modules/*/service.js`.
Tenant always comes from the session, never from the request.

## Roles
Owner 100 > Manager 70 > Cashier / Inventory Staff 30. You manage only accounts ranked below you (owners may also manage owners). Enforced in `src/modules/users/service.js`.

## PearlSolutions super admin (Step 4)
- Sign in at `/login` with the `SEED_PLATFORM_*` account. Platform admins have **no business membership**: their session
  has `membershipId = null` and lands on `/platform`. Business users can never open `/platform` and platform admins never
  resolve as a business user (`resolveSession` vs `resolvePlatformSession` in `src/lib/auth/session.js`).
- Guards: `requirePlatformPage()` for pages, `requirePlatformApi(request)` for `/api/platform/*` (`src/lib/auth/platform-guard.js`).
- Clients: create a business together with its first Owner login (generate a temporary password and copy the details),
  edit details, set Paid/Unpaid + monthly fee + due date, suspend/reactivate, reset an owner's password.
- Billing is informational: "Overdue" = unpaid and past the due date. Nothing is blocked automatically; use **Suspend** to
  lock a client out (everyone is signed out and cannot sign in until reactivated).
- API: `GET/POST /api/platform/clients`, `GET/PATCH /api/platform/clients/:id`,
  `POST /api/platform/clients/:id/owner-password`, `GET /api/platform/stats`, `POST /api/platform/account/password`.
- Pure rules (overdue, totals, slugs, password generator) live in `src/lib/platform/*.mjs` and are covered by `tests/platform.test.mjs`.

## POS, payments, receipts, dashboard (Steps 5, 6, 7)

**Pages:** `/pos` (counter), `/orders` (history + filters), `/orders/:id` (detail, take payment, cancel),
`/orders/:id/receipt` (printable, `?w=58|80`, `?autoprint=1`), `/` (dashboard). Cashiers land on `/pos`.
**API:** `GET /api/pos/products`, `GET/POST /api/orders`, `GET /api/orders/:id`, `POST /api/orders/:id/payments`, `POST /api/orders/:id/cancel`.

**How an order is confirmed** (`src/modules/orders/service.js`, one DB transaction):
1. The browser sends only `productId`, `quantity`, `amountReceived` and a `clientRequestId`. Prices and totals are read/computed on the server.
2. Total, change and outstanding are computed in **integer paisa** (`src/lib/money.mjs`), never floats.
3. Order number comes from `TenantSettings.nextOrderNo` (per business).
4. Order, item **snapshots** (name, unit price) and the payment row are saved.
5. Each ingredient is decremented with `UPDATE ... WHERE stock >= need`, so two simultaneous sales cannot make stock negative (the DB also has `CHECK (stock >= 0)`), and a `USAGE` stock movement is written with the order id.
6. Any failure rolls everything back. The same `clientRequestId` returns the existing order (retries cannot double-deduct).

**Payments:** `Change Returned = max(received - owed, 0)`, `Outstanding = max(owed - received, 0)`. `amountPaid` on an order is cash *applied*, never includes change.
Status is `PAID`, `PARTIAL` or `UNPAID`; a later payment can be added from the order page.

**Roles:** cashier = POS + own orders + receipts. Cancelling and seeing all orders / the dashboard needs manager or owner (`orders.cancel`, `reports.view`, `dashboard.view`). Inventory staff never see sales.

**Dashboard definitions** (all by order date, cancelled orders excluded): *Order value* = sum of totals; *Collected* = cash applied to those orders; *Outstanding* = value - collected.
Business day = Pakistan time (UTC+5), set in `src/lib/orders/dates.mjs`. Inventory panels show current stock and ignore the date filter.

**Receipt printing** (setup opens from the **Printer** button in the header of Take Orders and Orders & Receipts; the `/printer` page still exists but is not a sidebar heading; `src/lib/printing/escpos.mjs`, `src/features/printing/`): the app runs in the cloud, so the **cashier's browser** talks to the printer next to it.
- *Direct (recommended):* ESC/POS bytes are built from the saved order (same `buildReceipt` model) and sent over **WebUSB** or **Web Serial** (COM / Bluetooth-serial printers). Connect once on `/printer` (the browser asks permission once), then receipts print silently, optionally right after each sale, with paper cut, cash-drawer pulse, 1-3 copies, 58 / 80 mm. Urdu/non-Latin item names are drawn as pictures (`raster.js`), otherwise they would print as `?`.
- *Fallback:* the browser print dialog (`/orders/:id/receipt`, `@page { size: 58mm|80mm auto }`) for any printer with an OS driver.
- *Needs:* Chrome or Edge, HTTPS (or localhost; plain `http://192.168.x.x` is not allowed by the browser for USB/Serial). Windows: a USB printer already claimed by its Windows driver cannot be opened by WebUSB (use Serial/Bluetooth, WinUSB via Zadig, or the dialog). LAN/Wi-Fi printers on port 9100 and iOS are not reachable from a web page.
- *Reliability:* one job at a time per device (no interleaved receipts), 4 KB USB / 256-byte serial chunks, one automatic retry, clear error messages. A print failure never blocks a sale; the receipt can be reprinted from the order page.
- *Paper:* no software limit. A 3-item bill is ~10 cm, so a 30 m (58 mm) roll gives ~300 receipts and a 70 m (80 mm) roll ~700. Shown live on `/printer` and on the receipt page.
- *Tests:* `tests/escpos.test.mjs` verifies the exact command bytes, line widths for 32/48 columns, wrapping, copies, drawer rules, Pakistan time and paper maths. It cannot replace a real-printer test: do the checklist below once per printer model.
- *First-time hardware checklist:* connect on `/printer` -> Print test slip (ruler lines must fit) -> make a sale -> confirm cut and drawer -> unplug the cable and sell once to see the error message -> reconnect and Print again.

**Known limits (Version 1):** no discounts or tax workflow (columns reserved); recipe quantities are in each ingredient's own unit (no unit conversion); cash only; cancelling does not track a refund; no "pending" order state (the counter confirms and pays immediately).

## Who can do what
- **Business owner (your customer)**: signs up by themselves at `/signup` (business name, type, their name, email, password). They get a 14-day free trial, become the single Business Owner and are signed in. They then add managers and staff under *My Team*, never another owner.
- **PearlSolutions (software owner)**: signs in at `/login` and lands on `/platform`. Sees every client, what they pay, who has not paid and who is suspended. Never sees a client's menu, stock or sales. Can still add a client by hand (My Clients > Add client) and reset an owner's password.
- **Staff** (manager, cashier, inventory): get their login from their owner. Anyone whose password was set by someone else must choose their own at first login (`User.mustChangePassword`).

## Going live checklist
- Set the monthly fee of each new client on its page in `/platform` (signups start at 0).
- Signup has a hidden honeypot field and an in-memory limit of 5 signups per IP per hour. Use a shared limiter when you run more than one server.
- **Password recovery:** `/login` and My Account link to `/forgot-password`. Business Owners and PearlSolutions platform admins can receive a 6-digit email code (10-minute expiry, one-time use, maximum 5 verification attempts); staff continue to request resets from their owner/manager. A successful reset invalidates all existing sessions and sends a "password changed" email. The request endpoint answers identically (and immediately: the work runs after the response) for known and unknown emails. Code limits are stored in the database so they hold on serverless hosting: 60 s between codes, 5 codes per account per hour, 5 guesses per code (`src/lib/auth/otp-policy.mjs`). IP throttling is still in memory (best effort).
- **SMTP:** configure `SMTP_HOST`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM` in `.env`. The current transport uses implicit TLS on port 465; for Gmail, use a Google App Password when 2-Step Verification is enabled. Never commit `.env` or share SMTP credentials.

## Business logo (per client) - set by PearlSolutions only
The logo is part of the client's branding, so **only the software owner uploads it**: `/platform` > My Clients > open the client > **Business logo** card (Upload / Change / Remove). Business owners and staff cannot change it; Shop Settings no longer has a logo section.
- Accepted: PNG / JPG / WebP, shrunk to 512 px in the browser, max 300 KB on the server; SVG is refused because it can carry scripts.
- Stored in its own table `TenantLogo` (bytea), so normal Tenant/settings queries never load the picture; `Tenant.logoUpdatedAt` is the cache-busting version in the image URL.
- Platform API (platform admin only): `GET / POST / DELETE /api/platform/clients/:id/logo`. Every change is written to the audit log (`platform.client_logo_changed` / `platform.client_logo_removed`).
- Business side is read-only: `GET /api/settings/logo` (no id in the URL, the tenant always comes from the session, so one client can never fetch another's logo). `POST` / `DELETE` there no longer exist.
- The sidebar shows the logo on a white chip (black logos stay visible), or the pink drop when a client has none.
- Code: `src/modules/platform/logo.js`, `src/features/platform/ClientLogoCard.js`, `src/app/api/platform/clients/[id]/logo/route.js`, `src/modules/settings/logo.js` (read), `src/lib/branding/logo.mjs`, `src/components/layout/TenantLogo.js`.
- Deploy: no new migration. The `TenantLogo` table from the earlier migration is reused.

## Branding & security notes
- PearlSolutions logo files live in `public/brand/` (`pearl-logo-light.png` for white cards, `pearl-logo-dark.png` for the dark sidebar, `pearl-mark.png` icon only); browser/app icons are `src/app/icon.png`, `apple-icon.png`, `favicon.ico`. Shops keep their own logo (uploaded by PearlSolutions in `/platform`).
- Pre-launch audit, fixes, open decisions and the launch smoke checklist: `docs/SECURITY_AUDIT.md`.
- `next.config.mjs` sets the security headers. Keep `usb=(self)` and `serial=(self)` in the Permissions-Policy or the receipt printer cannot connect.
