import { z } from 'zod';
import { optionalText, requiredName } from './common';

const base = {
  name: requiredName('Supplier name'),
  phone: optionalText(30),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email address.').max(254)]).transform((v) => v || null).nullable().optional(),
  address: optionalText(200),
  notes: optionalText(500),
};

export const createSupplierSchema = z.object(base);
export const updateSupplierSchema = z
  .object({ ...base, name: base.name.optional(), isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');
