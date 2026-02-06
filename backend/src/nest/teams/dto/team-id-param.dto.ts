/**
 * Team ID Param DTO
 *
 * Validation schema for team ID parameter.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Team ID parameter schema
 */
export const TeamIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Team ID Param DTO class
 */
export class TeamIdParamDto extends createZodDto(TeamIdParamSchema) {}
