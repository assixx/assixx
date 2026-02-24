/**
 * Create Maintenance Plan DTO
 *
 * Zod schema for creating a new TPM maintenance plan.
 * One plan per machine (enforced by DB UNIQUE constraint).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { TimeSchema, WeekdaySchema } from './common.dto.js';

export const CreateMaintenancePlanSchema = z.object({
  machineUuid: z.uuid('Ungültige Maschinen-UUID'),
  name: z
    .string()
    .trim()
    .min(1, 'Name ist erforderlich')
    .max(255, 'Name darf maximal 255 Zeichen lang sein'),
  baseWeekday: WeekdaySchema,
  baseRepeatEvery: z
    .number()
    .int()
    .min(1, 'Wiederholung muss mindestens 1 sein')
    .max(52, 'Wiederholung darf maximal 52 sein'),
  baseTime: TimeSchema.nullable().optional(),
  bufferHours: z
    .number()
    .min(0.5, 'Puffer muss mindestens 0.5 Stunden sein')
    .max(24, 'Puffer darf maximal 24 Stunden sein')
    .multipleOf(0.5, 'Puffer muss in 0.5er-Schritten angegeben werden')
    .default(4),
  shiftPlanRequired: z.boolean().default(true),
  notes: z
    .string()
    .trim()
    .max(5000, 'Notizen dürfen maximal 5000 Zeichen lang sein')
    .nullish(),
});

export class CreateMaintenancePlanDto extends createZodDto(
  CreateMaintenancePlanSchema,
) {}
