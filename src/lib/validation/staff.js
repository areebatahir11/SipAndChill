import { z } from 'zod';
import { ROLE_CODES } from '@/lib/permissions/codes.mjs';
import { emailSchema, passwordSchema } from './auth';

// A business has one owner, created by PearlSolutions: staff accounts are never created or promoted to OWNER.
const roleCode = z.enum(Object.values(ROLE_CODES).filter((c) => c !== ROLE_CODES.OWNER));
const name = z.string().trim().min(2, 'Name is too short.').max(80);

export const createStaffSchema = z.object({ name, email: emailSchema, password: passwordSchema, roleCode });

export const updateStaffSchema = z
  .object({ name: name.optional(), roleCode: roleCode.optional(), isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const resetPasswordSchema = z.object({ newPassword: passwordSchema });
