/**
 * Query Response DTOs
 *
 * Validation schemas for querying survey responses.
 */
import { createZodDto } from 'nestjs-zod';

import { PaginationSchema } from '../../../schemas/common.schema.js';

/**
 * Get all responses query parameters schema
 */
export const GetAllResponsesQuerySchema = PaginationSchema;

/**
 * Get All Responses Query DTO class
 */
export class GetAllResponsesQueryDto extends createZodDto(
  GetAllResponsesQuerySchema,
) {}
