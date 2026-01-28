/**
 * Update Availability Entry DTO
 *
 * Validation schema for updating an existing availability history entry.
 * Used when editing entries in the availability history table.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * Availability status enum
 */
const AvailabilityStatusSchema = z.enum([
  'available',
  'unavailable',
  'vacation',
  'sick',
  'training',
  'other',
]);

/**
 * Update availability entry request body schema
 */
export const UpdateAvailabilityEntrySchema = z.object({
  status: AvailabilityStatusSchema,
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z
    .string()
    .trim()
    .max(255, 'Reason must not exceed 255 characters')
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(500, 'Notes must not exceed 500 characters')
    .nullable()
    .optional(),
});

/**
 * Update Availability Entry DTO class
 */
export class UpdateAvailabilityEntryDto extends createZodDto(
  UpdateAvailabilityEntrySchema,
) {}
