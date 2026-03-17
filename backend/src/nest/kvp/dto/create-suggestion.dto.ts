/**
 * Create KVP Suggestion DTO
 *
 * Validation schema for creating KVP improvement suggestions.
 * Team is auto-assigned from the creator's team membership (user_teams).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'], {
  message: 'Priority must be low, normal, high, or urgent',
});

/**
 * Create suggestion request body schema
 *
 * Team assignment is automatic — derived from the creator's user_teams membership.
 * Either categoryId (global) or customCategoryId (tenant-specific) must be provided.
 */
export const CreateSuggestionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Title must be at least 3 characters')
      .max(255, 'Title must not exceed 255 characters'),
    description: z
      .string()
      .trim()
      .min(10, 'Description must be at least 10 characters')
      .max(5000, 'Description must not exceed 5000 characters'),
    categoryId: IdSchema.optional().nullable(),
    customCategoryId: IdSchema.optional().nullable(),
    departmentId: IdSchema.optional().nullable(),
    priority: PrioritySchema.optional(),
    expectedBenefit: z
      .string()
      .trim()
      .max(1000, 'Expected benefit cannot exceed 1000 characters')
      .optional(),
    estimatedCost: z
      .string()
      .trim()
      .max(100, 'Estimated cost cannot exceed 100 characters')
      .optional(),
  })
  .refine(
    (data: {
      categoryId?: number | null | undefined;
      customCategoryId?: number | null | undefined;
    }) => data.categoryId != null || data.customCategoryId != null,
    {
      message: 'Either categoryId or customCategoryId must be provided',
      path: ['categoryId'],
    },
  );

/**
 * Create Suggestion DTO class
 */
export class CreateSuggestionDto extends createZodDto(CreateSuggestionSchema) {}
