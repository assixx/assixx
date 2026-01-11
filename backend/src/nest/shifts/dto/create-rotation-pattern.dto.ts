/**
 * Create Rotation Pattern DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';
import { PatternConfigSchema, PatternTypeSchema } from './rotation-common.dto.js';

/**
 * Create rotation pattern request body
 */
export const CreateRotationPatternSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Pattern name is required')
    .max(200, 'Name cannot exceed 200 characters'),
  description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').optional(),
  teamId: z.number().int().positive().nullable().optional(),
  patternType: PatternTypeSchema,
  patternConfig: PatternConfigSchema,
  cycleLengthWeeks: z.number().int().min(1).max(52).default(2),
  startsAt: ShiftDateSchema,
  endsAt: ShiftDateSchema.optional(),
  isActive: z.boolean().default(true),
});

export class CreateRotationPatternDto extends createZodDto(CreateRotationPatternSchema) {}
