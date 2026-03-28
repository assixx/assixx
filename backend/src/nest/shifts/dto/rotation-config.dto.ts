/**
 * Rotation Config DTO
 *
 * Zod schema for algorithm-based rotation generation.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';
import {
  NthWeekdayFreeRuleSchema,
  ShiftBlockTypeSchema,
  ShiftGroupSchema,
} from './rotation-common.dto.js';

/**
 * Employee assignment for algorithm-based rotation
 */
const EmployeeAssignmentSchema = z.object({
  userId: z.number().int().positive('User ID is required'),
  userName: z.string().trim().min(1, 'User name is required'),
  startGroup: ShiftGroupSchema,
});

/**
 * Shift block configuration for algorithm-based rotation
 */
const ShiftBlockConfigSchema = z.object({
  shiftBlockLength: z.number().int().min(1).max(14),
  freeDays: z.number().int().min(0).max(14),
  startShift: ShiftBlockTypeSchema,
  shiftSequence: z.array(ShiftBlockTypeSchema).length(3),
  specialRules: z.array(NthWeekdayFreeRuleSchema).optional(),
});

/**
 * Generate rotation from config request body (algorithm-based)
 */
export const GenerateRotationFromConfigSchema = z.object({
  config: ShiftBlockConfigSchema,
  assignments: z.array(EmployeeAssignmentSchema).min(1, 'At least one assignment is required'),
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
  teamId: z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
});

export class GenerateRotationFromConfigDto extends createZodDto(GenerateRotationFromConfigSchema) {}
