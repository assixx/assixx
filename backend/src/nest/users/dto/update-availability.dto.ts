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
const AvailabilityStatusSchema = z.enum(['available', 'vacation', 'sick', 'training', 'other']);

/**
 * Update availability request body schema
 */
export const UpdateAvailabilitySchema = z.object({
  availabilityStatus: AvailabilityStatusSchema,
  availabilityStart: z.iso.datetime().optional(),
  availabilityEnd: z.iso.datetime().optional(),
  availabilityNotes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
});

/**
 * Update Availability DTO class
 */
export class UpdateAvailabilityDto extends createZodDto(UpdateAvailabilitySchema) {}
