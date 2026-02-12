/**
 * Create Holiday DTO
 *
 * Zod schema for creating a tenant holiday.
 * UNIQUE(tenant_id, holiday_date) enforced at DB level.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { DateSchema } from './common.dto.js';

export const CreateHolidaySchema = z.object({
  holidayDate: DateSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters'),
  recurring: z.boolean().default(true),
});

export class CreateHolidayDto extends createZodDto(CreateHolidaySchema) {}
