/**
 * Shift Plan DTOs
 *
 * Zod schemas for shift plan operations.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema, ShiftTypeSchema, TimeSchema } from './common.dto.js';

/**
 * Individual shift item in shift plan
 */
export const ShiftPlanItemSchema = z.object({
  userId: z.number().int().positive('User ID is required'),
  date: ShiftDateSchema,
  type: ShiftTypeSchema,
  startTime: TimeSchema,
  endTime: TimeSchema,
});

/**
 * Create shift plan request body
 */
export const CreateShiftPlanSchema = z.object({
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
  departmentId: z.number().int().positive('Department ID is required'),
  areaId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  machineId: z.number().int().positive().optional(),
  name: z.string().trim().max(200, 'Name cannot exceed 200 characters').optional(),
  shiftNotes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  shifts: z.array(ShiftPlanItemSchema).min(1, 'Mindestens eine Schicht muss eingetragen sein'),
});

export class CreateShiftPlanDto extends createZodDto(CreateShiftPlanSchema) {}
