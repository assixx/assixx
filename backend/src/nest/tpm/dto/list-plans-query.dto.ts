/**
 * TPM List Plans Query DTO
 *
 * Pagination query parameters for GET /tpm/plans.
 */
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { LimitSchema, PageSchema } from './common.dto.js';

export const ListPlansQuerySchema = z.object({
  page: PageSchema,
  limit: LimitSchema,
});

export class ListPlansQueryDto extends createZodDto(ListPlansQuerySchema) {}
