/**
 * Update Custom Category DTO
 *
 * Validation schema for updating a tenant-specific category.
 * All fields optional — only provided fields are updated.
 * Used with PUT /kvp/categories/custom/:id
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateCustomCategorySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Category name is required')
      .max(50, 'Category name must not exceed 50 characters')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Description must not exceed 500 characters')
      .optional(),
    color: z
      .string()
      .regex(
        /^#[0-9a-f]{6}$/i,
        'Color must be a valid hex color (e.g. #ff0000)',
      )
      .optional(),
    icon: z
      .string()
      .trim()
      .min(1, 'Icon is required')
      .max(50, 'Icon name must not exceed 50 characters')
      .optional(),
  })
  .refine(
    (data: {
      name?: string | undefined;
      description?: string | undefined;
      color?: string | undefined;
      icon?: string | undefined;
    }) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.color !== undefined ||
      data.icon !== undefined,
    { message: 'At least one field must be provided for update' },
  );

export class UpdateCustomCategoryDto extends createZodDto(
  UpdateCustomCategorySchema,
) {}
