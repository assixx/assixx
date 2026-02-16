/**
 * Update Vacation Request DTO
 *
 * Zod schema for editing an existing pending vacation request.
 * Only the requester can edit, and only while status is 'pending'.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  DateSchema,
  VacationHalfDaySchema,
  VacationTypeSchema,
} from './common.dto.js';

const BaseSchema = z.object({
  startDate: DateSchema.optional(),
  endDate: DateSchema.optional(),
  halfDayStart: VacationHalfDaySchema.optional(),
  halfDayEnd: VacationHalfDaySchema.optional(),
  vacationType: VacationTypeSchema.optional(),
  substituteId: z.number().int().positive().nullish(),
  requestNote: z
    .string()
    .trim()
    .max(1000, 'Request note cannot exceed 1000 characters')
    .nullish(),
});

type BaseInput = z.infer<typeof BaseSchema>;

export const UpdateVacationRequestSchema = BaseSchema.refine(
  (data: BaseInput) => {
    if (data.startDate !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = new Date(data.startDate);
      start.setHours(0, 0, 0, 0);
      return start >= today;
    }
    return true;
  },
  {
    message: 'Startdatum darf nicht in der Vergangenheit liegen',
    path: ['startDate'],
  },
).refine(
  (data: BaseInput) => {
    if (data.startDate !== undefined && data.endDate !== undefined) {
      return data.endDate >= data.startDate;
    }
    return true;
  },
  { message: 'End date must be on or after start date', path: ['endDate'] },
);

export class UpdateVacationRequestDto extends createZodDto(
  UpdateVacationRequestSchema,
) {}
