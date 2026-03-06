/**
 * Update Asset Availability Entry DTO
 *
 * Validation schema for updating an existing asset availability
 * history entry. Used when editing entries in the history table.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { AssetAvailabilityStatusSchema } from './asset-availability-shared.js';

/**
 * Update asset availability entry request body schema
 */
export const UpdateAssetAvailabilityEntrySchema = z.object({
  status: AssetAvailabilityStatusSchema,
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

export class UpdateAssetAvailabilityEntryDto extends createZodDto(
  UpdateAssetAvailabilityEntrySchema,
) {}
