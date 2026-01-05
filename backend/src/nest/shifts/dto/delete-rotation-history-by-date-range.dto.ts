/**
 * Delete Rotation History By Date Range DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { ShiftDateSchema } from './common.dto.js';

/**
 * Delete rotation history by date range parameters
 * API v2: camelCase only
 */
export const DeleteRotationHistoryByDateRangeSchema = z.object({
  teamId: z.coerce.number().int().positive('teamId is required'),
  startDate: ShiftDateSchema,
  endDate: ShiftDateSchema,
});

export class DeleteRotationHistoryByDateRangeDto extends createZodDto(
  DeleteRotationHistoryByDateRangeSchema,
) {}
