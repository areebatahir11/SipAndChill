import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { ROLE_CODES } from '@/lib/permissions/codes.mjs';
import { pickFreeSlug, slugify } from '@/lib/platform/billing.mjs';
import { TENANT_STATUS } from '@/lib/platform/constants.mjs';
import { assertBusinessNameFree } from './names';

const EMAIL_TAKEN = new HttpError(409, 'An account with this email already exists. Try signing in instead.', 'EMAIL_TAKEN');

/**
 * The one place a business is created: the business, its settings and its single Business Owner login,
 * in one transaction. Used by public signup and by PearlSolutions' "Add client".
 * owner.passwordHash is already hashed. `mustChangePassword` is true when someone else chose the password.
 * `status` PENDING creates the business switched off (isActive false) until PearlSolutions approves it.
 */
export async function provisionBusiness({ businessName, businessType, monthlyFee = 0, dueDate = null, owner, mustChangePassword = false, status = TENANT_STATUS.ACTIVE }) {
  const nameKey = await assertBusinessNameFree(businessName); // same name as an existing business is refused, whatever the email
  const base = slugify(businessName);
  const [ownerRole, emailInUse, sameSlug] = await Promise.all([
    prisma.role.findUnique({ where: { code: ROLE_CODES.OWNER } }),
    prisma.user.findUnique({ where: { email: owner.email }, select: { id: true } }),
    prisma.tenant.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } }),
  ]);
  if (!ownerRole) throw new HttpError(500, 'System roles are missing. Run "npm run db:seed" first.', 'NO_ROLES');
  if (emailInUse) throw EMAIL_TAKEN;

  const slug = pickFreeSlug(base, sameSlug.map((t) => t.slug));
  try {
    return await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: businessName, nameKey, slug, businessType, monthlyFee, dueDate, status, isActive: status === TENANT_STATUS.ACTIVE, settings: { create: {} } },
      });
      const user = await tx.user.create({ data: { name: owner.name, email: owner.email, passwordHash: owner.passwordHash, mustChangePassword } });
      const membership = await tx.membership.create({ data: { tenantId: tenant.id, userId: user.id, roleId: ownerRole.id } });
      return { tenantId: tenant.id, userId: user.id, membershipId: membership.id, slug };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'That email or business name was just taken. Please try again.', 'CONFLICT');
    throw e;
  }
}
