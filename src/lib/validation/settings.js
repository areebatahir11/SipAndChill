import { z } from 'zod';

const optionalText = (max) => z.string().trim().max(max).transform((v) => (v === '' ? null : v)).nullable().optional();

export const updateSettingsSchema = z
  .object({
    businessName: z.string().trim().min(2, 'Business name is too short.').max(80).optional(),
    phone: optionalText(30),
    address: optionalText(200),
    receiptWidthMm: z.union([z.literal(58), z.literal(80)]).optional(),
    receiptFooter: z.string().trim().min(1, 'Receipt footer cannot be empty.').max(120).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');
