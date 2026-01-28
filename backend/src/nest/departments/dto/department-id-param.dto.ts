/**
 * Department ID Param DTO
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Department ID parameter schema
 */
export const DepartmentIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * Department ID Param DTO class
 */
export class DepartmentIdParamDto extends createZodDto(
  DepartmentIdParamSchema,
) {}
