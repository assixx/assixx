/**
 * Update Maintenance Plan DTO
 *
 * Zod schema for updating an existing TPM maintenance plan.
 * All fields optional — only provided fields are updated.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TimeSchema, WeekdaySchema } from './common.dto.js';

export const UpdateMaintenancePlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen lang sein')
    .optional(),
  baseWeekday: WeekdaySchema.optional(),
  baseRepeatEvery: z
    .number()
    .int()
    .min(1, 'Wiederholung muss mindestens 1 sein')
    .max(52, 'Wiederholung darf maximal 52 sein')
    .optional(),
  baseTime: TimeSchema.nullable().optional(),
  shiftPlanRequired: z.boolean().optional(),
  notes: z
    .string()
    .trim()
    .max(5000, 'Notizen dürfen maximal 5000 Zeichen lang sein')
    .nullish(),
});

export class UpdateMaintenancePlanDto extends createZodDto(
  UpdateMaintenancePlanSchema,
) {}
