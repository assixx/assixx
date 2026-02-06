/**
 * Create Custom Category DTO
 *
 * Validation schema for creating a new tenant-specific category.
 * Used with POST /kvp/categories/custom
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateCustomCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Category name is required')
    .max(50, 'Category name must not exceed 50 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, 'Color must be a valid hex color (e.g. #ff0000)'),
  icon: z
    .string()
    .trim()
    .min(1, 'Icon is required')
    .max(50, 'Icon name must not exceed 50 characters'),
});

export class CreateCustomCategoryDto extends createZodDto(
  CreateCustomCategorySchema,
) {}
