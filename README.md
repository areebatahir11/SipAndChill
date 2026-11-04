# Sip&Chill Admin: PearlSolutions multi-tenant POS & inventory

Next.js (App Router) + Tailwind CSS v4 + Prisma/PostgreSQL. First client: Sip & Chill.

## Setup
1. `cp .env.example .env` and fill `DATABASE_URL`, `DIRECT_URL`, `SEED_ADMIN_*` (Supabase or local PostgreSQL).
2. `npm install` (also runs `prisma generate`)
3. `npx prisma migrate dev`
4. Supabase only: run `prisma/supabase-rls.sql` in the SQL Editor.
5. `npm run db:seed`, then `npm run dev` and open http://localhost:3000
6. `npm test` runs the permission unit tests.

## Folder structure
```
src/
  app/
    (auth)/login          public login page
    (dashboard)/          signed-in shell (layout = auth guard + sidebar); one folder per module
    api/                  thin REST route handlers (validate -> service)
  components/
    ui/                   Tailwind primitives: Button, Card, Field, Modal, Pill, Alert, DataTable...
    layout/               Sidebar, AuthProvider, ModulePending
  features/<module>/      client components for one module (staff, settings, account, auth)
  modules/<module>/       server business logic (services), tenant-scoped
  lib/                    auth, permissions, validation (zod), http helpers, db client, api-client
prisma/                   schema, migrations, seed
```
Rules: pages are server components that call `requirePage(permission)` then render a feature component.
API handlers call `requireApi(request, permission)`, parse with zod, and delegate to `modules/*/service.js`.
Tenant always comes from the session, never from the request.

## Roles
Owner 100 > Manager 70 > Cashier / Inventory Staff 30. You manage only accounts ranked below you (owners may also manage owners). Enforced in `src/modules/users/service.js`.
