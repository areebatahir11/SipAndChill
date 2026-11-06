import { z } from 'zod';
import { nonNegative, optionalText, requiredName } from './common';
import { decimalPlaces } from '@/lib/money.mjs';

const idOrNull = z.string().trim().transform((v) => v || null).nullable();

const categoryBase = { name: requiredName('Category name'), description: optionalText(200) };
export const createCategorySchema = z.object(categoryBase);
export const updateCategorySchema = z
  .object({ ...categoryBase, name: categoryBase.name.optional(), isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

const productBase = {
  name: requiredName('Item name'),
  categoryId: idOrNull.optional(),
  description: optionalText(200),
  price: nonNegative('Price'),
};
export const createProductSchema = z.object(productBase);
export const updateProductSchema = z
  .object({
    name: productBase.name.optional(),
    categoryId: productBase.categoryId,
    description: productBase.description,
    price: z.preprocess((v) => (v === '' ? undefined : v), productBase.price.optional()),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');

export const recipeSchema = z
  .object({
    items: z
      .array(
        z.object({
          ingredientId: z.string().trim().min(1, 'Choose an ingredient.'),
          quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number.' }).gt(0, 'Quantity must be greater than zero.').max(9_999_999).refine((v) => decimalPlaces(v) <= 3, 'Quantity can have at most 3 decimal places.'),
        })
      )
      .max(40, 'A recipe can have at most 40 lines.'),
  })
  .refine((v) => new Set(v.items.map((i) => i.ingredientId)).size === v.items.length, { message: 'An ingredient is listed twice.', path: ['items'] });
