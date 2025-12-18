/**
 * Delete Rotation History By Date Range DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * Delete rotation history by date range parameters
 */
export const DeleteRotationHistoryByDateRangeSchema = z.object({
  team_id: z.coerce.number().int().positive('team_id is required'),
  start_date: ShiftDateSchema,
  end_date: ShiftDateSchema,
});

export class DeleteRotationHistoryByDateRangeDto extends createZodDto(
  DeleteRotationHistoryByDateRangeSchema,
) {}
