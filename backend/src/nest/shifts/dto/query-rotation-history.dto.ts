/**
 * Query Rotation History DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * Query rotation history parameters
 */
export const QueryRotationHistorySchema = z.object({
  pattern_id: z.coerce.number().int().positive().optional(),
  user_id: z.coerce.number().int().positive().optional(),
  team_id: z.coerce.number().int().positive().optional(),
  start_date: ShiftDateSchema.optional(),
  end_date: ShiftDateSchema.optional(),
  status: z.enum(['generated', 'confirmed', 'modified', 'cancelled']).optional(),
});

export class QueryRotationHistoryDto extends createZodDto(QueryRotationHistorySchema) {}
