/**
 * Create KVP Suggestion DTO
 *
 * Validation schema for creating KVP improvement suggestions.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Organization level enum
 */
const OrgLevelSchema = z.enum(['company', 'department', 'area', 'team'], {
  message: 'Organization level must be company, department, area, or team',
});

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'], {
  message: 'Priority must be low, normal, high, or urgent',
});

/**
 * Create suggestion request body schema
 */
export const CreateSuggestionSchema = z.object({
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
  categoryId: IdSchema,
  departmentId: IdSchema.optional().nullable(),
  orgLevel: OrgLevelSchema,
  orgId: z.number().int().min(0, 'Organization ID must be a non-negative integer'),
  priority: PrioritySchema.optional(),
  expectedBenefit: z
    .string()
    .trim()
    .max(500, 'Expected benefit cannot exceed 500 characters')
    .optional(),
  estimatedCost: z
    .string()
    .trim()
    .max(100, 'Estimated cost cannot exceed 100 characters')
    .optional(),
});

/**
 * Create Suggestion DTO class
 */
export class CreateSuggestionDto extends createZodDto(CreateSuggestionSchema) {}
