import { z } from 'zod';
import { nonNegative, requiredName } from './common';
import { decimalPlaces } from '@/lib/money.mjs';

export const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'pack', 'dozen'];
export const KINDS = ['INGREDIENT', 'MATERIAL'];
export const MANUAL_MOVEMENTS = ['PURCHASE', 'WASTAGE', 'ADJUSTMENT'];

const date = z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date.')]).transform((v) => v || null).nullable();

const base = {
  name: requiredName('Name'),
  kind: z.enum(KINDS),
  unit: z.enum(UNITS),
  minStock: nonNegative('Reorder level', 3),
  costPerUnit: nonNegative('Cost'),
  expiryDate: date.optional(),
  supplierId: z.string().trim().transform((v) => v || null).nullable().optional(),
};

export const createIngredientSchema = z.object({ ...base, openingStock: nonNegative('Opening stock', 3).optional() });

export const updateIngredientSchema = z
  .object({
    name: base.name.optional(),
    kind: base.kind.optional(),
    unit: base.unit.optional(),
    minStock: z.preprocess((v) => (v === '' ? undefined : v), base.minStock.optional()),
    costPerUnit: z.preprocess((v) => (v === '' ? undefined : v), base.costPerUnit.optional()),
    expiryDate: base.expiryDate,
    supplierId: base.supplierId,
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

/**
 * PURCHASE:   quantity received (adds). unitCost optional, updates the ingredient's cost.
 * WASTAGE:    quantity thrown away (subtracts).
 * ADJUSTMENT: quantity is the COUNTED stock on the shelf; the system records the difference.
 */
export const stockMovementSchema = z
  .object({
    type: z.enum(MANUAL_MOVEMENTS),
    quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).min(0).max(9_999_999).refine((v) => decimalPlaces(v) <= 3, 'Quantity can have at most 3 decimal places.'),
    unitCost: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(0).max(9_999_999).refine((v) => decimalPlaces(v) <= 2, 'Cost can have at most 2 decimal places.').optional()),
    note: z.string().trim().max(200).transform((v) => v || null).nullable().optional(),
  })
  .refine((v) => v.type === 'ADJUSTMENT' || v.quantity > 0, { message: 'Quantity must be greater than zero.', path: ['quantity'] });
