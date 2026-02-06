/**
 * Override Category Name DTO
 *
 * Validation schema for renaming a global default category for a tenant.
 * Used with PUT /kvp/categories/override/:categoryId
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const OverrideCategoryNameSchema = z.object({
  customName: z
    .string()
    .trim()
    .min(1, 'Custom name is required')
    .max(50, 'Custom name must not exceed 50 characters'),
});

export class OverrideCategoryNameDto extends createZodDto(
  OverrideCategoryNameSchema,
) {}
