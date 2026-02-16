/**
 * Create/Update Entitlement DTO
 *
 * Zod schema for creating or updating a user's vacation entitlement for a given year.
 * UNIQUE(tenant_id, user_id, year) — uses INSERT ON CONFLICT UPDATE.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DaysSchema, NonNegativeDaysSchema, YearSchema } from './common.dto.js';

export const CreateEntitlementSchema = z.object({
  userId: z.number().int().positive('User ID is required'),
  year: YearSchema,
  totalDays: DaysSchema.default(30),
  carriedOverDays: NonNegativeDaysSchema.default(0),
  additionalDays: NonNegativeDaysSchema.default(0),
  carryOverExpiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
});

export class CreateEntitlementDto extends createZodDto(
  CreateEntitlementSchema,
) {}
