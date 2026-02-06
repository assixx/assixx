/**
 * Create Shift DTO
 *
 * Zod schema for creating new shifts.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  ShiftDateSchema,
  ShiftStatusSchema,
  ShiftTypeSchema,
  TimeSchema,
} from './common.dto.js';

/**
 * Create shift request body
 */
export const CreateShiftSchema = z.object({
  userId: z.number().int().positive('User ID is required'),
  date: ShiftDateSchema,
  startTime: TimeSchema,
  endTime: TimeSchema,
  departmentId: z.number().int().positive('Department ID is required'),
  planId: z.number().int().positive().optional(),
  areaId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  machineId: z.number().int().positive().optional(),
  title: z
    .string()
    .trim()
    .max(200, 'Title cannot exceed 200 characters')
    .optional(),
  requiredEmployees: z
    .number()
    .int()
    .positive('Required employees must be a positive integer')
    .optional(),
  breakMinutes: z
    .number()
    .int()
    .min(0, 'Break minutes must be non-negative')
    .optional(),
  status: ShiftStatusSchema.optional(),
  type: ShiftTypeSchema.optional(),
  notes: z
    .string()
    .trim()
    .max(1000, 'Notes cannot exceed 1000 characters')
    .optional(),
});

export class CreateShiftDto extends createZodDto(CreateShiftSchema) {}
