/**
 * Update Entitlement DTO
 *
 * Zod schema for updating an existing vacation entitlement.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DaysSchema, NonNegativeDaysSchema } from './common.dto.js';

export const UpdateEntitlementSchema = z.object({
  totalDays: DaysSchema.optional(),
  carriedOverDays: NonNegativeDaysSchema.optional(),
  additionalDays: NonNegativeDaysSchema.optional(),
  carryOverExpiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .nullish(),
});

export class UpdateEntitlementDto extends createZodDto(
  UpdateEntitlementSchema,
) {}
