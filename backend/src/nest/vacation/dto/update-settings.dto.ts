/**
 * Update Settings DTO
 *
 * Zod schema for updating tenant-wide vacation settings.
 * Uses UPSERT (INSERT ON CONFLICT UPDATE) — one row per tenant.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateSettingsSchema = z.object({
  defaultAnnualDays: z
    .number()
    .positive('Default annual days must be positive')
    .multipleOf(0.5, 'Must be a multiple of 0.5')
    .optional(),
  maxCarryOverDays: z.number().min(0, 'Max carry-over cannot be negative').optional(),
  carryOverDeadlineMonth: z
    .number()
    .int()
    .min(1)
    .max(12, 'Month must be between 1 and 12')
    .optional(),
  carryOverDeadlineDay: z.number().int().min(1).max(31, 'Day must be between 1 and 31').optional(),
  advanceNoticeDays: z.number().int().min(0, 'Advance notice days cannot be negative').optional(),
  maxConsecutiveDays: z.number().int().positive('Max consecutive days must be positive').nullish(),
});

export class UpdateSettingsDto extends createZodDto(UpdateSettingsSchema) {}
