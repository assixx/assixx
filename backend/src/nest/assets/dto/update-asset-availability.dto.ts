/**
 * Update Asset Availability DTO
 *
 * Validation schema for creating a asset availability entry
 * (planned maintenance window, repair period, etc.).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AssetAvailabilityStatusSchema } from './asset-availability-shared.js';

/**
 * Update asset availability request body schema
 * Creates a new entry in asset_availability table
 */
export const UpdateAssetAvailabilitySchema = z.object({
  availabilityStatus: AssetAvailabilityStatusSchema,
  availabilityStart: z.iso.date().optional(),
  availabilityEnd: z.iso.date().optional(),
  availabilityReason: z
    .string()
    .trim()
    .max(255, 'Reason must not exceed 255 characters')
    .optional(),
  availabilityNotes: z.string().trim().max(500, 'Notes must not exceed 500 characters').optional(),
});

export class UpdateAssetAvailabilityDto extends createZodDto(UpdateAssetAvailabilitySchema) {}
