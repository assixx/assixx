/**
 * User ID Param DTO
 *
 * Validation schema for user ID parameter.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * User ID parameter schema
 */
export const UserIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * User ID Param DTO class
 */
export class UserIdParamDto extends createZodDto(UserIdParamSchema) {}
