/**
 * Update Availability DTO
 *
 * Validation schema for updating user availability status.
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
 * Update availability request body schema
 * Now writes to user_availability table (users table columns deprecated)
 */
export const UpdateAvailabilitySchema = z.object({
  availabilityStatus: AvailabilityStatusSchema,
  availabilityStart: z.iso.date().optional(),
  availabilityEnd: z.iso.date().optional(),
  availabilityReason: z
    .string()
    .trim()
    .max(255, 'Reason must not exceed 255 characters')
    .optional(),
  availabilityNotes: z
    .string()
    .trim()
    .max(500, 'Notes must not exceed 500 characters')
    .optional(),
});

/**
 * Update Availability DTO class
 */
export class UpdateAvailabilityDto extends createZodDto(
  UpdateAvailabilitySchema,
) {}
