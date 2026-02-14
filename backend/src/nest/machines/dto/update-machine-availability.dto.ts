/**
 * Update Machine Availability DTO
 *
 * Validation schema for creating a machine availability entry
 * (planned maintenance window, repair period, etc.).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { MachineAvailabilityStatusSchema } from './machine-availability-shared.js';

/**
 * Update machine availability request body schema
 * Creates a new entry in machine_availability table
 */
export const UpdateMachineAvailabilitySchema = z.object({
  availabilityStatus: MachineAvailabilityStatusSchema,
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

export class UpdateMachineAvailabilityDto extends createZodDto(
  UpdateMachineAvailabilitySchema,
) {}
