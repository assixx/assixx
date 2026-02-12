/**
 * Create Vacation Request DTO
 *
 * Zod schema for submitting a new vacation request.
 * computed_days is server-calculated (A5) — never sent by client.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  DateSchema,
  VacationHalfDaySchema,
  VacationTypeSchema,
} from './common.dto.js';

const BaseSchema = z.object({
  startDate: DateSchema,
  endDate: DateSchema,
  halfDayStart: VacationHalfDaySchema.default('none'),
  halfDayEnd: VacationHalfDaySchema.default('none'),
  vacationType: VacationTypeSchema.default('regular'),
  substituteId: z.number().int().positive().optional(),
  requestNote: z
    .string()
    .trim()
    .max(1000, 'Request note cannot exceed 1000 characters')
    .optional(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const CreateVacationRequestSchema = BaseSchema.refine(
  (data: BaseInput) => data.endDate >= data.startDate,
  {
    message: 'End date must be on or after start date',
    path: ['endDate'],
  },
).refine(
  (data: BaseInput) => {
    // Single-day: at most ONE half-day modifier (DB constraint valid_half_day_single)
    if (data.startDate === data.endDate) {
      return data.halfDayStart === 'none' || data.halfDayEnd === 'none';
    }
    return true;
  },
  {
    message: 'Single-day requests can only have one half-day modifier',
    path: ['halfDayEnd'],
  },
);

export class CreateVacationRequestDto extends createZodDto(
  CreateVacationRequestSchema,
) {}
