/**
 * Create Time Estimate DTO
 *
 * Zod schema for setting expected durations per maintenance interval.
 * One estimate per (plan, interval_type) combination (DB UNIQUE constraint).
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  MinutesSchema,
  StaffCountSchema,
  TpmIntervalTypeSchema,
} from './common.dto.js';

export const CreateTimeEstimateSchema = z.object({
  planUuid: z.uuid('Ungültige Plan-UUID'),
  intervalType: TpmIntervalTypeSchema,
  staffCount: StaffCountSchema.default(1),
  preparationMinutes: MinutesSchema.default(0),
  executionMinutes: MinutesSchema.default(0),
  followupMinutes: MinutesSchema.default(0),
});

export class CreateTimeEstimateDto extends createZodDto(
  CreateTimeEstimateSchema,
) {}
