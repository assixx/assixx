/**
 * Update Holiday DTO
 *
 * Zod schema for updating an existing tenant holiday.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from './common.dto.js';

export const UpdateHolidaySchema = z.object({
  holidayDate: DateSchema.optional(),
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  recurring: z.boolean().optional(),
});

export class UpdateHolidayDto extends createZodDto(UpdateHolidaySchema) {}
