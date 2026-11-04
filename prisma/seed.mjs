// Seeds permissions, system roles, the first tenant and its first Business Admin.
// Safe to re-run. The admin credentials come from environment variables: nothing is hardcoded.
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSION_CATALOG, ROLE_DEFAULTS, ROLE_CODES } from '../src/lib/permissions/codes.mjs';

const prisma = new PrismaClient();

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}. Set it in .env (see .env.example).`);
  return v;
}

async function main() {
  const email = required('SEED_ADMIN_EMAIL').trim().toLowerCase();
  const password = required('SEED_ADMIN_PASSWORD');
  const adminName = process.env.SEED_ADMIN_NAME || 'Owner';
  if (password.length < 10 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error('SEED_ADMIN_PASSWORD must be 10-72 characters and contain a letter and a number.');
  }

  // 1. Permissions
  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({ where: { code: p.code }, update: { module: p.module, description: p.description }, create: p });
  }
  const permissionRows = await prisma.permission.findMany();
  const permissionId = Object.fromEntries(permissionRows.map((p) => [p.code, p.id]));

  // 2a. Step 1 used the code ADMIN; it is now OWNER. Rename in place so existing memberships keep working.
  const legacyAdmin = await prisma.role.findUnique({ where: { code: 'ADMIN' } });
  if (legacyAdmin && !(await prisma.role.findUnique({ where: { code: ROLE_CODES.OWNER } }))) {
    await prisma.role.update({ where: { id: legacyAdmin.id }, data: { code: ROLE_CODES.OWNER } });
    console.log('Renamed role ADMIN to OWNER.');
  }

  // 2b. System roles (their permission sets are re-synced to the defaults on every seed)
  const roleId = {};
  for (const [code, def] of Object.entries(ROLE_DEFAULTS)) {
    const role = await prisma.role.upsert({
      where: { code },
      update: { name: def.name, description: def.description, rank: def.rank },
      create: { code, name: def.name, description: def.description, rank: def.rank, isSystem: true },
    });
    roleId[code] = role.id;
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({ data: def.permissions.map((c) => ({ roleId: role.id, permissionId: permissionId[c] })) }),
    ]);
  }

  // 3. First tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'sip-and-chill' },
    update: {},
    create: { name: 'Sip & Chill', slug: 'sip-and-chill', businessType: 'JUICE_SHOP', currency: 'PKR' },
  });

  // 4. First Business Admin (only created if the email does not exist yet)
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: adminName, passwordHash: await bcrypt.hash(password, 12) } });
    console.log(`Created admin user ${email}`);
  } else {
    console.log(`Admin user ${email} already exists. Password left unchanged.`);
  }
  await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
    update: {},
    create: { tenantId: tenant.id, userId: user.id, roleId: roleId[ROLE_CODES.OWNER] },
  });
  await prisma.tenantSettings.upsert({ where: { tenantId: tenant.id }, update: {}, create: { tenantId: tenant.id } });
  console.log('Seed complete.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
