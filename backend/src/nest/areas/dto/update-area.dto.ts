/**
 * Update Area DTO
 *
 * Validation schema for updating existing areas.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AreaTypeSchema } from './create-area.dto.js';

/**
 * Update area request body schema (all fields optional)
 */
export const UpdateAreaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Area name must be at least 2 characters')
    .max(255, 'Area name must not exceed 255 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .nullable()
    .optional(),
  areaLeadId: z.coerce
    .number()
    .int()
    .positive('Area lead ID must be a positive integer')
    .nullable()
    .optional(),
  type: AreaTypeSchema.optional(),
  capacity: z.coerce
    .number()
    .int()
    .nonnegative('Capacity must be a non-negative integer')
    .nullable()
    .optional(),
  address: z
    .string()
    .trim()
    .max(500, 'Address must not exceed 500 characters')
    .nullable()
    .optional(),
  isActive: z.coerce.number().int().min(0).max(4).optional(),
});

/**
 * Update Area DTO class
 */
export class UpdateAreaDto extends createZodDto(UpdateAreaSchema) {}
