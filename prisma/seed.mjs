// Seeds permissions, system roles and the PearlSolutions super admin (the software owner).
// Businesses and their owners are NOT seeded: add every client from /platform > My Clients > Add client.
// Safe to re-run. Credentials come from environment variables: nothing is hardcoded.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSION_CATALOG, ROLE_DEFAULTS } from '../src/lib/permissions/codes.mjs';

const prisma = new PrismaClient();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Set it in .env (see .env.example).`);
  return v;
}

function assertStrongPassword(name, password) {
  if (password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error(`${name} must be 10-72 characters and contain a letter and a number.`);
  }
}

/** PearlSolutions super admin (Step 4). Optional: skipped when SEED_PLATFORM_EMAIL is not set. Never overwrites an existing password. */
async function seedPlatformAdmin() {
  const email = process.env.SEED_PLATFORM_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Missing SEED_PLATFORM_EMAIL. Set it in .env (see .env.example).');
  const password = required('SEED_PLATFORM_PASSWORD');
  assertStrongPassword('SEED_PLATFORM_PASSWORD', password);

  const existing = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
  if (existing?.memberships.length) {
    throw new Error(`${email} already belongs to a business. Use a separate email for the platform admin.`);
  }
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { isPlatformAdmin: true } });
    console.log(`Platform admin ${email} already exists. Password left unchanged.`);
  } else {
    await prisma.user.create({
      data: { email, name: process.env.SEED_PLATFORM_NAME || 'PearlSolutions Admin', passwordHash: await bcrypt.hash(password, 12), isPlatformAdmin: true },
    });
    console.log(`Created platform admin ${email}`);
  }
}

async function main() {
  // 1. Permissions
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({ where: { code: p.code }, update: { module: p.module, description: p.description }, create: p });
  }
  const permissionRows = await prisma.permission.findMany();
  const permissionId = Object.fromEntries(permissionRows.map((p) => [p.code, p.id]));

  // 2. System roles (their permission sets are re-synced to the defaults on every seed)
  for (const [code, def] of Object.entries(ROLE_DEFAULTS)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: def.name, description: def.description, rank: def.rank },
      create: { code, name: def.name, description: def.description, rank: def.rank, isSystem: true },
    });
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({ data: def.permissions.map((c) => ({ roleId: role.id, permissionId: permissionId[c] })) }),
    ]);
  }

  // 3. The software owner
  await seedPlatformAdmin();
  console.log('Seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
