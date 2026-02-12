/**
 * Capacity Query DTO
 *
 * Zod schema for capacity analysis query parameters.
 * Used by GET /vacation/capacity endpoint.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from './common.dto.js';

const BaseSchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
  requesterId: z.coerce.number().int().positive().optional(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const CapacityQuerySchema = BaseSchema.refine(
  (data: BaseInput) => data.endDate >= data.startDate,
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export class CapacityQueryDto extends createZodDto(CapacityQuerySchema) {}
