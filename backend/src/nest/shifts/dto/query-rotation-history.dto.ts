/**
 * Query Rotation History DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * Query rotation history parameters
 * API v2: camelCase only
 */
export const QueryRotationHistorySchema = z.object({
  patternId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  teamId: z.coerce.number().int().positive().optional(),
  startDate: ShiftDateSchema.optional(),
  endDate: ShiftDateSchema.optional(),
  status: z
    .enum(['generated', 'confirmed', 'modified', 'cancelled'])
    .optional(),
});

export class QueryRotationHistoryDto extends createZodDto(
  QueryRotationHistorySchema,
) {}
