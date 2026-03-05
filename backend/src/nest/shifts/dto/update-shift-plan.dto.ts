/**
 * Update Shift Plan DTO
 *
 * Zod schema for updating shift plans.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema, ShiftTypeSchema, TimeSchema } from './common.dto.js';

/**
 * Individual shift item in update shift plan
 */
const ShiftPlanUpdateItemSchema = z.object({
  userId: z.number().int().positive('User ID is required'),
  date: ShiftDateSchema,
  type: ShiftTypeSchema,
  startTime: TimeSchema.optional(),
  endTime: TimeSchema.optional(),
});

/**
 * Update shift plan request body (all fields optional)
 */
export const UpdateShiftPlanSchema = z.object({
  startDate: ShiftDateSchema.optional(),
  endDate: ShiftDateSchema.optional(),
  departmentId: z.number().int().positive().optional(),
  areaId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  assetId: z.number().int().positive().optional(),
  name: z
    .string()
    .trim()
    .max(200, 'Name cannot exceed 200 characters')
    .optional(),
  shiftNotes: z
    .string()
    .trim()
    .max(2000, 'Notes cannot exceed 2000 characters')
    .optional(),
  isTpmMode: z.boolean().optional(),
  shifts: z.array(ShiftPlanUpdateItemSchema).optional(),
});

export class UpdateShiftPlanDto extends createZodDto(UpdateShiftPlanSchema) {}
