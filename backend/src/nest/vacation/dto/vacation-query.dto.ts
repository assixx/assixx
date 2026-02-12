/**
 * Vacation Query DTO
 *
 * Zod schema for paginated vacation request queries.
 * Used for both own requests and incoming requests endpoints.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import {
  LimitSchema,
  PageSchema,
  VacationRequestStatusSchema,
  VacationTypeSchema,
  YearSchema,
} from './common.dto.js';

export const VacationQuerySchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
  year: YearSchema.optional(),
  status: VacationRequestStatusSchema.optional(),
  vacationType: VacationTypeSchema.optional(),
});

export class VacationQueryDto extends createZodDto(VacationQuerySchema) {}
