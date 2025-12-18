/**
 * Entry ID Param DTO
 *
 * Path parameter for audit entry ID.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { IdSchema } from '../../../schemas/common.schema.js';

/**
 * Audit entry ID parameter schema
 */
export const EntryIdParamSchema = z.object({
  id: IdSchema,
});

/**
 * DTO for entry ID path parameter
 */
export class EntryIdParamDto extends createZodDto(EntryIdParamSchema) {}
