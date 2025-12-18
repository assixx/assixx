/**
 * Create Area DTO
 *
 * Validation schema for creating new areas.
 * Status: 0=inactive, 1=active, 3=archived, 4=deleted
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Area type enum schema
 */
export const AreaTypeSchema = z.enum(
  ['building', 'warehouse', 'office', 'production', 'outdoor', 'other'],
  {
    message: 'Type must be one of: building, warehouse, office, production, outdoor, other',
  },
);

/**
 * Create area request body schema
 */
export const CreateAreaSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Area name must be at least 2 characters')
    .max(255, 'Area name must not exceed 255 characters'),
  description: z
    .string()
    .trim()
    .max(1000, 'Description must not exceed 1000 characters')
    .optional(),
  areaLeadId: z.coerce
    .number()
    .int()
    .positive('Area lead ID must be a positive integer')
    .nullable()
    .optional(),
  type: AreaTypeSchema.default('other'),
  capacity: z.coerce
    .number()
    .int()
    .nonnegative('Capacity must be a non-negative integer')
    .nullable()
    .optional(),
  address: z.string().trim().max(500, 'Address must not exceed 500 characters').optional(),
});

/**
 * Create Area DTO class
 */
export class CreateAreaDto extends createZodDto(CreateAreaSchema) {}
