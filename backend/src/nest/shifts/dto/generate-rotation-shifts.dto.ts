/**
 * Generate Rotation Shifts DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * Generate rotation shifts request body
 */
export const GenerateRotationShiftsSchema = z.object({
  patternId: z.number().int().positive('Pattern ID is required'),
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
  preview: z.boolean().default(false),
});

export class GenerateRotationShiftsDto extends createZodDto(
  GenerateRotationShiftsSchema,
) {}
