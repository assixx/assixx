/**
 * Query Survey DTO
 *
 * Validation schema for listing and filtering surveys.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * Survey status enum
 */
const SurveyStatusSchema = z.enum(['draft', 'active', 'closed'], {
  message: 'Invalid status',
});

/**
 * List surveys query parameters schema
 */
export const ListSurveysQuerySchema = PaginationSchema.extend({
  status: SurveyStatusSchema.optional(),
});

/**
 * List Surveys Query DTO class
 */
export class ListSurveysQueryDto extends createZodDto(ListSurveysQuerySchema) {}
