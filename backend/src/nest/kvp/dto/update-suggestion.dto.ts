/**
 * Update KVP Suggestion DTO
 *
 * Validation schema for updating KVP improvement suggestions.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * KVP suggestion status enum
 */
const StatusSchema = z.enum(
  ['new', 'in_review', 'approved', 'implemented', 'rejected', 'archived'],
  {
    message: 'Invalid status value',
  },
);

/**
 * Priority enum
 */
const PrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'], {
  message: 'Priority must be low, normal, high, or urgent',
});

/**
 * Update suggestion request body schema (all fields optional)
 */
export const UpdateSuggestionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(255, 'Title must not exceed 255 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must not exceed 5000 characters')
    .optional(),
  categoryId: IdSchema.optional(),
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
  actualSavings: z.preprocess(
    (val: unknown) => (typeof val === 'string' ? Number.parseFloat(val) : val),
    z
      .number()
      .min(0, 'Actual savings must be a non-negative number')
      .optional(),
  ),
  status: StatusSchema.optional(),
  assignedTo: IdSchema.optional(),
  rejectionReason: z
    .string()
    .trim()
    .max(500, 'Rejection reason cannot exceed 500 characters')
    .optional(),
});

/**
 * Update Suggestion DTO class
 */
export class UpdateSuggestionDto extends createZodDto(UpdateSuggestionSchema) {}
