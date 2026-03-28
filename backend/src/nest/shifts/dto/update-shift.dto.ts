/**
 * Update Shift DTO
 *
 * Zod schema for updating shifts.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ShiftDateSchema,
  ShiftStatusSchema,
  ShiftTypeSchema,
  TimeSchema,
  TimeWithSecondsSchema,
} from './common.dto.js';

/**
 * Update shift request body (all fields optional)
 */
export const UpdateShiftSchema = z.object({
  userId: z.number().int().positive().optional(),
  date: ShiftDateSchema.optional(),
  startTime: TimeSchema.optional(),
  endTime: TimeSchema.optional(),
  actualStart: TimeWithSecondsSchema.optional(),
  actualEnd: TimeWithSecondsSchema.optional(),
  departmentId: z.number().int().positive().optional(),
  planId: z.number().int().positive().optional(),
  templateId: z.number().int().positive().optional(),
  areaId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  assetId: z.number().int().positive().optional(),
  title: z.string().trim().max(200, 'Title cannot exceed 200 characters').optional(),
  requiredEmployees: z
    .number()
    .int()
    .positive('Required employees must be a positive integer')
    .optional(),
  breakMinutes: z.number().int().min(0, 'Break minutes must be non-negative').optional(),
  status: ShiftStatusSchema.optional(),
  type: ShiftTypeSchema.optional(),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
});

export class UpdateShiftDto extends createZodDto(UpdateShiftSchema) {}
